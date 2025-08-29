// webapp/src/services/study.ts
import { supabase } from '../lib/supabaseClient';

export type StudyVisibility = 'group' | 'leaders' | 'private';
export type StudyCollabRole = 'owner' | 'editor' | 'viewer';

export type StudySeries = {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  visibility: StudyVisibility;
  owner_id: string;
  created_at: string;
  updated_at: string;
  my_role?: StudyCollabRole | null;
};

export type StudyEntry = {
  id: string;
  series_id: string;
  title: string;
  content: string | null;
  focus_ref: string | null;
  position: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type StudyCollaborator = {
  user_id: string;
  role: StudyCollabRole;
  display_name: string | null;
  email: string | null;
};

export type StudyInvite = {
  id: string;
  token: string;
  role: StudyCollabRole;
  inviter_id: string;
  created_at: string;
  used_by: string | null;
  used_at: string | null;
};

export type StudyQuestion = {
  id: string;
  entry_id: string;
  author_id: string;
  content: string;
  visibility: StudyVisibility;
  created_at: string;
};

export type StudyAnswer = {
  id: string;
  question_id: string;
  author_id: string;
  content: string;
  created_at: string;
};

/* ───────────────────────────────────────────────────────────────
   Series & entries
──────────────────────────────────────────────────────────────── */

export async function listSeries(groupId: string): Promise<StudySeries[]> {
  // Prefer RPC with my_role
  const { data, error } = await supabase.rpc('sg_list_series', { p_group_id: groupId });
  if (error) throw new Error(error.message);
  return (data ?? []) as StudySeries[];
}

export async function createSeries(params: {
  group_id: string;
  title: string;
  description?: string;
  visibility?: StudyVisibility;
}): Promise<string> {
  const { data, error } = await supabase.rpc('sg_create_series', {
    p_group_id: params.group_id,
    p_title: params.title.trim(),
    p_description: params.description?.trim() || null,
    p_visibility: (params.visibility ?? 'group') as StudyVisibility,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function listEntries(seriesId: string): Promise<StudyEntry[]> {
  const { data, error } = await supabase.rpc('sg_list_entries', { p_series_id: seriesId });
  if (error) throw new Error(error.message);
  // The RPC returns "position" as "position" — TS property name is position (ok)
  return (data ?? []) as StudyEntry[];
}

export async function addEntry(params: {
  series_id: string;
  title: string;
  content?: string;
  focus_ref?: string;
  position?: number;
}): Promise<string> {
  const { data, error } = await supabase.rpc('sg_add_entry', {
    p_series_id: params.series_id,
    p_title: params.title.trim(),
    p_content: params.content ?? null,
    p_position: params.position ?? 1,
    p_focus_ref: params.focus_ref?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function updateEntry(
  entryId: string,
  patch: Partial<Pick<StudyEntry, 'title' | 'content' | 'focus_ref' | 'position'>>
): Promise<void> {
  const { error } = await supabase.rpc('sg_update_entry', {
    p_entry_id: entryId,
    p_title: patch.title ?? null,
    p_content: patch.content ?? null,
    p_position: patch.position ?? null,
    p_focus_ref: patch.focus_ref ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function deleteEntry(entryId: string): Promise<void> {
  const { error } = await supabase.rpc('sg_delete_entry', { p_entry_id: entryId });
  if (error) throw new Error(error.message);
}

/* ───────────────────────────────────────────────────────────────
   Collaborators & invites
──────────────────────────────────────────────────────────────── */

export async function listCollaborators(seriesId: string): Promise<StudyCollaborator[]> {
  // Get collaborator rows
  const { data, error } = await supabase
    .from('study_collaborators')
    .select('user_id, role')
    .eq('series_id', seriesId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { user_id: string; role: StudyCollabRole }[];

  if (rows.length === 0) return [];

  // Fetch profile info in one go
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles, error: e2 } = await supabase
    .from('profiles')
    .select('id, display_name, email')
    .in('id', ids);
  if (e2) throw new Error(e2.message);
  const map = new Map<string, { display_name: string | null; email: string | null }>();
  (profiles ?? []).forEach((p: any) => map.set(p.id, { display_name: p.display_name ?? null, email: p.email ?? null }));

  return rows.map((r) => ({
    user_id: r.user_id,
    role: r.role,
    display_name: map.get(r.user_id)?.display_name ?? null,
    email: map.get(r.user_id)?.email ?? null,
  }));
}

export async function listInvites(seriesId: string): Promise<StudyInvite[]> {
  const { data, error } = await supabase
    .from('study_invites')
    .select('id, token, role, inviter_id, created_at, used_by, used_at')
    .eq('series_id', seriesId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as StudyInvite[];
}

export async function createInvite(seriesId: string, role: StudyCollabRole = 'viewer'): Promise<string> {
  const { data, error } = await supabase.rpc('sg_create_invite', {
    p_series_id: seriesId,
    p_role: role,
  });
  if (error) throw new Error(error.message);
  return data as string; // token
}

/* ───────────────────────────────────────────────────────────────
   Q&A
──────────────────────────────────────────────────────────────── */

export async function addQuestion(
  entryId: string,
  content: string,
  visibility: StudyVisibility = 'group'
): Promise<string> {
  const { data, error } = await supabase.rpc('sg_add_question', {
    p_entry_id: entryId,
    p_content: content,
    p_visibility: visibility,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function addAnswer(questionId: string, content: string): Promise<string> {
  const { data, error } = await supabase.rpc('sg_add_answer', {
    p_question_id: questionId,
    p_content: content,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export type QuestionWithAnswers = StudyQuestion & { answers: StudyAnswer[] };

export async function listQuestionsWithAnswers(entryId: string): Promise<QuestionWithAnswers[]> {
  const { data: qs, error } = await supabase
    .from('study_questions')
    .select('*')
    .eq('entry_id', entryId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  const questions = (qs ?? []) as StudyQuestion[];

  if (questions.length === 0) return [];

  const ids = questions.map((q) => q.id);
  const { data: ans, error: e2 } = await supabase
    .from('study_answers')
    .select('*')
    .in('question_id', ids)
    .order('created_at', { ascending: true });
  if (e2) throw new Error(e2.message);
  const answers = (ans ?? []) as StudyAnswer[];

  const byQ = new Map<string, StudyAnswer[]>();
  answers.forEach((a) => {
    const list = byQ.get(a.question_id) || [];
    list.push(a);
    byQ.set(a.question_id, list);
  });

  return questions.map((q) => ({ ...q, answers: byQ.get(q.id) ?? [] }));
}

// ── Study: accept invite ───────────────────────────────────────
export type AcceptStudyInviteResult = {
  series_id: string;
  group_id: string;
  role: 'owner' | 'editor' | 'viewer';
};

export async function acceptInvite(token: string): Promise<AcceptStudyInviteResult> {
  const { data, error } = await supabase.rpc('sg_accept_invite', { p_token: token });
  if (error) throw new Error(error.message);

  // Function returns a table -> PostgREST typically returns an array
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Invalid or expired invite token');
  return row as AcceptStudyInviteResult;
}

/* ───────────────────────────────────────────────────────────────
   Highlights
──────────────────────────────────────────────────────────────── */

export async function addHighlight(params: {
  entry_id: string;
  text: string;
  loc?: any;
  note?: string;
}): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error('Not signed in');

  const payload = {
    entry_id: params.entry_id,
    user_id: uid,
    text: params.text,
    loc: params.loc ?? null,
    note: params.note ?? null,
  };

  const { error } = await supabase.from('study_highlights').insert(payload);
  if (error) throw new Error(error.message);
}
