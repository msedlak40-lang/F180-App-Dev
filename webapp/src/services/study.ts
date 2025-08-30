// webapp/src/services/study.ts
import { supabase } from '../lib/supabaseClient';


/* =========================================================
   Weekly series generator (Edge Function)
   ========================================================= */

export type StudyGenVisibility = 'group' | 'leader' | 'private';

/**
 * Calls the sg-generate-series Edge Function.
 * - Pass { useAI: false } to do a dry-run (no OpenAI).
 * - Returns the new series_id.
 */
export async function generateWeeklySeries(
  groupId: string,
  title: string,
  opts?: {
    notes?: string;
    weeks?: number;                  // default 6, clamped 1..12
    visibility?: StudyGenVisibility; // default 'group'
    useAI?: boolean;                 // default true; false => dry-run
  }
): Promise<string> {
  const weeks = Math.max(1, Math.min(12, opts?.weeks ?? 6));
  const visibility = (opts?.visibility ?? 'group') as StudyGenVisibility;
  const dry_run = opts?.useAI === false;

  const { data, error } = await supabase.functions.invoke('sg-generate-series', {
    body: {
      group_id: groupId,
      title,
      notes: opts?.notes ?? null,
      weeks,
      visibility,
      dry_run,
    },
  });

  if (error) throw new Error((error as any)?.message ?? 'Failed to generate study');
  if (!data?.series_id) throw new Error('Generator returned no series_id');
  return data.series_id as string;
}

/* =========================================================
   Export helpers (Markdown export of a series)
   ========================================================= */

export type ExportSeries = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  visibility: 'group' | 'leader' | 'private';
};

export type ExportEntry = {
  id: string;
  title: string | null;
  content: string | null;
  focus_ref: string | null;
  position: number | null;
};

export type ExportQuestion = {
  id: string;
  entry_id: string;
  prompt: string | null;
  content: string | null;   // user-visible notes / text
  ai_answer: string | null; // model suggestion
  position: number | null;
};

/**
 * Fetch series + entries + questions for export.
 */
export async function fetchSeriesForExport(seriesId: string): Promise<{
  series: ExportSeries;
  entries: (ExportEntry & { questions: ExportQuestion[] })[];
}> {
  // 1) Series
  const { data: series, error: sErr } = await supabase
    .from('study_series')
    .select('id, title, description, created_at, visibility')
    .eq('id', seriesId)
    .single();
  if (sErr) throw new Error(sErr.message);
  if (!series) throw new Error('Series not found');

  // 2) Entries
  const { data: entries, error: eErr } = await supabase
    .from('study_entries')
    .select('id, title, content, focus_ref, position')
    .eq('series_id', seriesId)
    .order('position', { ascending: true });
  if (eErr) throw new Error(eErr.message);

  const entryIds = (entries ?? []).map((e) => e.id);
  let questionsByEntry: Record<string, ExportQuestion[]> = {};

  // 3) Questions
  if (entryIds.length) {
    const { data: questions, error: qErr } = await supabase
      .from('study_questions')
      .select('id, entry_id, prompt, content, ai_answer, position')
      .in('entry_id', entryIds)
      .order('entry_id', { ascending: true })
      .order('position', { ascending: true });
    if (qErr) throw new Error(qErr.message);

    questionsByEntry = (questions ?? []).reduce((acc: any, q) => {
      (acc[q.entry_id] ||= []).push(q as ExportQuestion);
      return acc;
    }, {});
  }

  const withQs = (entries ?? []).map((e) => ({
    ...(e as ExportEntry),
    questions: questionsByEntry[e.id] ?? [],
  }));

  return { series: series as ExportSeries, entries: withQs };
}

/* =========================================================
   Collaborators (inline panel uses these)
   ========================================================= */

export type StudyCollabRole = 'owner' | 'editor' | 'viewer';
export type StudyCollaborator = {
  user_id: string;
  role: StudyCollabRole;
  display_name: string | null;
  email: string | null;
};

/**
 * Lists collaborators for a series.
 * This uses a FK join: study_collaborators.user_id -> profiles.id
 */
export async function listSeriesCollaborators(seriesId: string): Promise<StudyCollaborator[]> {
  // 1) Get collaborator rows (no embedding)
  const { data: rows, error } = await supabase
    .from('study_collaborators')
    .select('user_id, role')
    .eq('series_id', seriesId);

  if (error) throw new Error(error.message);
  const collabs = (rows ?? []) as { user_id: string; role: StudyCollabRole }[];
  if (collabs.length === 0) return [];

  // 2) Fetch profiles in a separate query and join client-side
  const ids = Array.from(new Set(collabs.map((c) => c.user_id)));
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, display_name, email')
    .in('id', ids);

  if (pErr) {
    // If profiles are RLS-restricted, still return basic rows
    return collabs.map((c) => ({
      user_id: c.user_id,
      role: c.role,
      display_name: null,
      email: null,
    }));
  }

  const byId = Object.fromEntries(
    (profiles ?? []).map((p: any) => [p.id, { display_name: p.display_name ?? null, email: p.email ?? null }])
  );

  return collabs.map((c) => ({
    user_id: c.user_id,
    role: c.role,
    display_name: byId[c.user_id]?.display_name ?? null,
    email: byId[c.user_id]?.email ?? null,
  }));
}


/**
 * Invite a collaborator by email.
 * Requires RPC: sg_invite_email(p_series_id uuid, p_email text, p_role dev_collab_role)
 */
export async function inviteStudyByEmail(
  seriesId: string,
  email: string,
  role: 'viewer' | 'editor' = 'viewer'
): Promise<void> {
  const { error } = await supabase.rpc('sg_invite_email', {
    p_series_id: seriesId,
    p_email: email,
    p_role: role,
  } as any);
  if (error) throw new Error(error.message);
}

/**
 * Create an invite link for a series.
 * Requires RPC: sg_create_invite_link_simple(p_series_id uuid, p_role dev_collab_role)
 * Returns a sharable URL like: https://app/#/study-invite?token=...
 */
export async function createStudyInviteLink(
  seriesId: string,
  role: 'viewer' | 'editor' = 'viewer'
): Promise<{ token: string; url: string }> {
  const { data, error } = await supabase.rpc('sg_create_invite_link_simple', {
    p_series_id: seriesId,
    p_role: role,
  } as any);
  if (error) throw new Error(error.message);

  const token =
    (data as any)?.token ||
    (data as any)?.invite_token ||
    (Array.isArray(data) && data[0]?.token) ||
    (Array.isArray(data) && data[0]?.invite_token);

  if (!token) throw new Error('Invite token not returned');

  const base = window.location.origin;
  const url = `${base}/#/study-invite?token=${token}`;
  return { token, url };
}
// --- Accept study invite (by token) ---
export async function acceptInvite(
  token: string
): Promise<{ series_id: string; role?: 'viewer' | 'editor' | 'owner' }> {
  // Try common arg names to match your RPC signature
  const tryArgs = [
    { p_token: token },
    { token },
    { invite_token: token },
    { p_invite_token: token },
  ];

  let lastErr: any = null;
  for (const args of tryArgs) {
    const { data, error } = await supabase.rpc('sg_accept_invite', args as any);
    if (!error) {
      // Normalize common return shapes
      const pick = (d: any, k: string) =>
        (d && d[k]) ||
        (Array.isArray(d) && d[0] && d[0][k]) ||
        null;

      const series_id = pick(data, 'series_id');
      const role = pick(data, 'role');

      if (!series_id) throw new Error('Invite accepted but no series_id returned');
      return { series_id, role: role as any };
    }
    lastErr = error;
    // keep looping to try next arg shape
  }
  throw new Error(lastErr?.message ?? 'Failed to accept invite');
}
// --- My answers per question ---

export type StudyAnswer = {
  id: string;
  question_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export async function listMyAnswers(questionIds: string[]): Promise<Record<string, StudyAnswer>> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid || questionIds.length === 0) return {};
  const { data, error } = await supabase
    .from('study_answers')
    .select('id, question_id, author_id, content, created_at, updated_at')
    .in('question_id', questionIds)
    .eq('author_id', uid);
  if (error) throw new Error(error.message);
  const map: Record<string, StudyAnswer> = {};
  (data ?? []).forEach((a: any) => {
    map[a.question_id] = a as StudyAnswer;
  });
  return map;
}

export async function saveMyAnswer(questionId: string, content: string): Promise<StudyAnswer> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) throw new Error('Not signed in');

  // relies on unique index (question_id, author_id) for upsert
  const { data, error } = await supabase
    .from('study_answers')
    .upsert([{ question_id: questionId, author_id: uid, content }], {
      onConflict: 'question_id,author_id',
    })
    .select('id, question_id, author_id, content, created_at, updated_at')
    .single();

  if (error) throw new Error(error.message);
  return data as StudyAnswer;
}

export async function deleteMyAnswer(answerId: string): Promise<void> {
  const { error } = await supabase.from('study_answers').delete().eq('id', answerId);
  if (error) throw new Error(error.message);
}
