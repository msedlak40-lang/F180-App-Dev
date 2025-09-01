// PREVIEW-ONLY Study service wired to your existing tables.
// Includes: series, entries, highlights, questions/answers, per-user bookmarks & archives,
// collaborators & invites, and direct loaders for Bookmarks/Archived tabs.

import { supabase } from "../lib/supabaseClient";

/** ---------- Types ---------- */
export type StudySeries = {
  id: string;
  group_id: string;
  title: string;
  description?: string | null;
  visibility?: string | null;
  owner_id: string;
  generated?: boolean | null;
  generator_model?: string | null;
  generator_meta?: any | null;
  created_at?: string;
  updated_at?: string;
  section_count?: number | null; // computed
  is_bookmarked?: boolean;       // UI only
};

export type StudyEntry = {
  id: string;
  series_id: string;
  title: string;
  content: string | null;
  focus_ref?: string | null;
  position: number;
  created_by: string;
  created_at?: string;
  updated_at?: string;
};

export type StudyQuestion = {
  id: string;
  entry_id: string;
  prompt: string | null;
  content: string | null;
  ai_answer: string | null;
  position: number | null;
};

export type StudyAnswer = {
  id: string;
  question_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type StudyEntryProgress = {
  entry_id: string;
  user_id: string;
  is_read: boolean;
  percent?: number | null;
  last_read_at?: string | null;
  series_id?: string | null;
};

export type HighlightRow = {
  id: string;
  entry_id: string;
  user_id: string;
  text: string;
  loc: any | null;
  note?: string | null;
  created_at: string;
};

export type StudyCollaborator = {
  user_id: string;
  role: "editor" | "viewer";
  display_name: string | null;
  email: string | null;
};

export type StudyInvite = {
  id: string;
  token: string;
  role: "editor" | "viewer";
  email_lock: string | null;   // mapped flexibly from DB
  max_uses: number | null;
  used_count: number | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

/** ---------- Auth helpers ---------- */
async function requireUid(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) throw new Error("Not authenticated");
  return data.user.id;
}
async function uid(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

/** ---------- SERIES ---------- */
export async function listSeriesForGroup(opts: { groupId: string; onlyMine?: boolean }): Promise<StudySeries[]> {
  let q = supabase
    .from("study_series")
    .select("*")
    .eq("group_id", opts.groupId)
    .order("created_at", { ascending: false });

  if (opts.onlyMine) {
    const me = await uid();
    if (me) q = q.eq("owner_id", me);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let series = (data || []) as StudySeries[];

  // compute section_count
  const ids = series.map((s) => s.id);
  if (ids.length) {
    const { data: entryRows } = await supabase
      .from("study_entries")
      .select("id,series_id")
      .in("series_id", ids);

    const counts: Record<string, number> = {};
    (entryRows || []).forEach((r: any) => {
      counts[r.series_id] = (counts[r.series_id] || 0) + 1;
    });

    series = series.map((s) => ({ ...s, section_count: counts[s.id] ?? 0, is_bookmarked: false }));
  }

  return series;
}

/** ---------- ENTRIES ---------- */
export async function listEntries(opts: { seriesId: string }): Promise<StudyEntry[]> {
  const { data, error } = await supabase
    .from("study_entries")
    .select("*")
    .eq("series_id", opts.seriesId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as StudyEntry[];
}

/** ---------- PROGRESS (preview stubs) ---------- */
export async function getMyProgressForSeries(_: { seriesId: string }): Promise<Record<string, StudyEntryProgress>> {
  return {};
}
export async function markEntryRead(_: { entryId: string }) {
  return { ok: true };
}

/** ---------- HIGHLIGHTS ---------- */
export async function listMyHighlightsForSeries(opts: { seriesId: string }): Promise<Record<string, number[]>> {
  const me = await requireUid();

  const { data: entries, error: e1 } = await supabase
    .from("study_entries")
    .select("id")
    .eq("series_id", opts.seriesId);
  if (e1) throw new Error(e1.message);

  const entryIds = (entries || []).map((r: any) => r.id);
  if (!entryIds.length) return {};

  const { data, error } = await supabase
    .from("study_highlights")
    .select("entry_id, loc")
    .eq("user_id", me)
    .in("entry_id", entryIds);
  if (error) throw new Error(error.message);

  const out: Record<string, number[]> = {};
  (data || []).forEach((row: any) => {
    const idx = typeof row?.loc?.sentence_index === "number" ? row.loc.sentence_index : null;
    if (idx == null) return;
    (out[row.entry_id] ||= []).push(idx);
  });
  Object.keys(out).forEach((k) => (out[k] = Array.from(new Set(out[k])).sort((a, b) => a - b)));
  return out;
}

export async function addHighlight(params: { entryId: string; sentence_index: number; text: string; note?: string | null }) {
  const me = await requireUid();
  const payload = {
    entry_id: params.entryId,
    user_id: me,
    text: params.text,
    loc: { sentence_index: params.sentence_index },
    note: params.note ?? null,
  };
  const { error } = await supabase.from("study_highlights").insert(payload);
  if (error) throw new Error(error.message);
}
export async function removeHighlight(params: { entryId: string; sentence_index: number }) {
  const me = await requireUid();
  const { error } = await supabase
    .from("study_highlights")
    .delete()
    .eq("user_id", me)
    .eq("entry_id", params.entryId)
    .contains("loc", { sentence_index: params.sentence_index });
  if (error) throw new Error(error.message);
}

/** ---------- QUESTIONS & ANSWERS ---------- */
export async function listQuestionsForEntries(entryIds: string[]): Promise<Record<string, StudyQuestion[]>> {
  if (!entryIds.length) return {};
  const { data, error } = await supabase
    .from("study_questions")
    .select("id, entry_id, prompt, content, ai_answer, position")
    .in("entry_id", entryIds)
    .order("entry_id", { ascending: true })
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);

  const map: Record<string, StudyQuestion[]> = {};
  (data || []).forEach((q: any) => {
    (map[q.entry_id] ||= []).push(q as StudyQuestion);
  });
  return map;
}

export async function listMyAnswers(questionIds: string[]): Promise<Record<string, StudyAnswer>> {
  const me = await uid();
  if (!me || !questionIds.length) return {};
  const { data, error } = await supabase
    .from("study_answers")
    .select("id, question_id, author_id, content, created_at, updated_at")
    .in("question_id", questionIds)
    .eq("author_id", me);
  if (error) throw new Error(error.message);
  const map: Record<string, StudyAnswer> = {};
  (data || []).forEach((r: any) => (map[r.question_id] = r as StudyAnswer));
  return map;
}

export async function saveMyAnswer(questionId: string, content: string): Promise<StudyAnswer> {
  const me = await requireUid();
  const { data, error } = await supabase
    .from("study_answers")
    .upsert([{ question_id: questionId, author_id: me, content }], { onConflict: "question_id,author_id" })
    .select("id, question_id, author_id, content, created_at, updated_at")
    .single();
  if (error) throw new Error(error.message);
  return data as StudyAnswer;
}

export async function deleteMyAnswer(answerId: string): Promise<void> {
  const { error } = await supabase.from("study_answers").delete().eq("id", answerId);
  if (error) throw new Error(error.message);
}

/** ---------- Entry Bookmarks & Archive (per-user flags) ---------- */
export async function listFlagsForEntries(entryIds: string[]) {
  const me = await uid();
  if (!me || entryIds.length === 0) return { bookmarked: new Set<string>(), archived: new Set<string>() };

  const [bm, ar] = await Promise.all([
    supabase.from("study_entry_bookmarks").select("entry_id").eq("user_id", me).in("entry_id", entryIds),
    supabase.from("study_entry_archives").select("entry_id").eq("user_id", me).in("entry_id", entryIds),
  ]);

  const bookmarked = new Set<string>((bm.data || []).map((r: any) => r.entry_id as string));
  const archived = new Set<string>((ar.data || []).map((r: any) => r.entry_id as string));
  return { bookmarked, archived };
}

export async function toggleBookmarkEntry(entryId: string, on: boolean) {
  const me = await requireUid();
  if (on) {
    const { error } = await supabase.from("study_entry_bookmarks").insert({ user_id: me, entry_id: entryId });
    if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("study_entry_bookmarks")
      .delete()
      .eq("user_id", me)
      .eq("entry_id", entryId);
    if (error) throw new Error(error.message);
  }
}

export async function toggleArchiveEntry({ entryId, archived }: { entryId: string; archived: boolean }) {
  const me = await requireUid();
  if (archived) {
    const { error } = await supabase.from("study_entry_archives").insert({ user_id: me, entry_id: entryId });
    if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("study_entry_archives")
      .delete()
      .eq("user_id", me)
      .eq("entry_id", entryId);
    if (error) throw new Error(error.message);
  }
}

/** ---------- Direct loaders for Bookmark/Archive tabs ---------- */
export async function listMyBookmarkedEntries(): Promise<{ bySeries: Record<string, StudyEntry[]>; ids: Set<string> }> {
  const me = await uid();
  if (!me) return { bySeries: {}, ids: new Set() };

  const { data: bms, error: e1 } = await supabase
    .from("study_entry_bookmarks")
    .select("entry_id")
    .eq("user_id", me);
  if (e1) throw new Error(e1.message);
  const ids = (bms || []).map((r: any) => r.entry_id as string);
  if (!ids.length) return { bySeries: {}, ids: new Set() };

  const { data: entries, error: e2 } = await supabase
    .from("study_entries")
    .select("*")
    .in("id", ids)
    .order("series_id", { ascending: true })
    .order("position", { ascending: true });
  if (e2) throw new Error(e2.message);

  const bySeries: Record<string, StudyEntry[]> = {};
  (entries || []).forEach((e: any) => {
    (bySeries[e.series_id] ||= []).push(e as StudyEntry);
  });
  return { bySeries, ids: new Set(ids) };
}

export async function listMyArchivedEntries(): Promise<{ bySeries: Record<string, StudyEntry[]>; ids: Set<string> }> {
  const me = await uid();
  if (!me) return { bySeries: {}, ids: new Set() };

  const { data: ars, error: e1 } = await supabase
    .from("study_entry_archives")
    .select("entry_id")
    .eq("user_id", me);
  if (e1) throw new Error(e1.message);
  const ids = (ars || []).map((r: any) => r.entry_id as string);
  if (!ids.length) return { bySeries: {}, ids: new Set() };

  const { data: entries, error: e2 } = await supabase
    .from("study_entries")
    .select("*")
    .in("id", ids)
    .order("series_id", { ascending: true })
    .order("position", { ascending: true });
  if (e2) throw new Error(e2.message);

  const bySeries: Record<string, StudyEntry[]> = {};
  (entries || []).forEach((e: any) => {
    (bySeries[e.series_id] ||= []).push(e as StudyEntry);
  });
  return { bySeries, ids: new Set(ids) };
}

/** ---------- Collaborators & Invites ---------- */
export async function mySeriesCapabilities(seriesId: string): Promise<{ can_edit: boolean }> {
  // Try RPC first
  try {
    const { data, error } = await supabase.rpc("study_can_edit_series", { p_series_id: seriesId });
    if (!error && typeof data === "boolean") return { can_edit: data };
  } catch {
    // ignore
  }

  const me = await uid();
  if (!me) return { can_edit: false };

  const [{ data: s }, { data: c }] = await Promise.all([
    supabase.from("study_series").select("owner_id").eq("id", seriesId).single(),
    supabase.from("study_collaborators").select("role").eq("series_id", seriesId).eq("user_id", me).limit(1),
  ]);

  const isOwner = !!s && (s as any).owner_id === me;
  const isEditor = !!(c && c.length && String(c[0].role) === "editor");
  return { can_edit: isOwner || isEditor };
}

export async function listCollaborators(seriesId: string): Promise<StudyCollaborator[]> {
  const { data: rows, error: e1 } = await supabase
    .from("study_collaborators")
    .select("user_id, role")
    .eq("series_id", seriesId);
  if (e1) throw new Error(e1.message);

  if (!rows?.length) return [];

  const userIds = rows.map((r: any) => r.user_id);
  const { data: profiles, error: e2 } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .in("id", userIds);
  if (e2) throw new Error(e2.message);

  const map = new Map<string, { display_name: string | null; email: string | null }>();
  (profiles ?? []).forEach((p: any) =>
    map.set(p.id, { display_name: p.display_name ?? null, email: p.email ?? null })
  );

  return (rows ?? []).map((r: any) => ({
    user_id: r.user_id,
    role: String(r.role) as "editor" | "viewer",
    display_name: map.get(r.user_id)?.display_name ?? null,
    email: map.get(r.user_id)?.email ?? null,
  }));
}

export async function removeCollaboratorByUser(seriesId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("study_collaborators")
    .delete()
    .match({ series_id: seriesId, user_id: userId });
  if (error) throw new Error(error.message);
}

// schema-flexible: do not assume `email_lock` exists in table
export async function listInvites(seriesId: string): Promise<StudyInvite[]> {
  const { data, error } = await supabase
    .from("study_invites")
    .select("*")
    .eq("series_id", seriesId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((r: any) => ({
    id: r.id,
    token: r.token,
    role: String(r.role) as "editor" | "viewer",
    email_lock: r.email_lock ?? r.email ?? r.locked_email ?? null,
    max_uses: r.max_uses ?? null,
    used_count: r.used_count ?? null,
    expires_at: r.expires_at ?? null,
    revoked_at: r.revoked_at ?? null,
    created_at: r.created_at,
  })) as StudyInvite[];
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const { error } = await supabase
    .from("study_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId);
  if (error) throw new Error(error.message);
}

// RPC preferred; fallback to adaptive column insert (`email_lock` or `email`)
export async function createInviteLinkSimple(
  seriesId: string,
  role: "editor" | "viewer",
  email?: string
): Promise<{ id: string; token: string; role: string; email_lock: string | null }> {
  try {
    const { data, error } = await supabase.rpc("study_create_invite_link_simple", {
      p_series_id: seriesId,
      p_role: role,
      p_email: email ?? null,
    });
    if (!error && data) {
      const row = Array.isArray(data) ? data[0] : data;
      return {
        id: row.id,
        token: row.token,
        role: row.role,
        email_lock: row.email_lock ?? row.email ?? row.locked_email ?? null,
      };
    }
  } catch {
    // ignore, try direct insert
  }

  let firstErr: any = null;
  // Attempt 1: email_lock
  try {
    const payload: any = { series_id: seriesId, role, max_uses: 1 };
    if (email) payload.email_lock = email;
    const { data, error } = await supabase
      .from("study_invites")
      .insert(payload)
      .select("id, token, role, email_lock, email")
      .single();
    if (error) throw error;
    const d: any = data;
    return {
      id: d.id,
      token: d.token,
      role: d.role,
      email_lock: d.email_lock ?? d.email ?? null,
    };
  } catch (e: any) {
    firstErr = e;
  }

  // Attempt 2: email
  try {
    const payload2: any = { series_id: seriesId, role, max_uses: 1 };
    if (email) payload2.email = email;
    const { data, error } = await supabase
      .from("study_invites")
      .insert(payload2)
      .select("id, token, role, email")
      .single();
    if (error) throw error;
    const d: any = data;
    return {
      id: d.id,
      token: d.token,
      role: d.role,
      email_lock: d.email ?? null,
    };
  } catch (e2: any) {
    throw new Error(e2?.message || firstErr?.message || "Failed to create invite");
  }
}

/** ---------- CREATE: series + entries (manual/client path) ---------- */
export async function createSeriesWithEntries(params: {
  groupId: string;
  title: string;
  description?: string | null;
  sections: Array<{ title: string; body_md: string; day_index?: number | null }>;
  generated?: boolean;
  generator_model?: string | null;
  generator_meta?: any | null;
  visibility?: "group" | "leader" | "leaders" | "private";
}): Promise<{ series: StudySeries; entries: StudyEntry[] }> {
  const me = await requireUid();

  const seriesInsert: Record<string, any> = {
    group_id: params.groupId,
    title: params.title,
    owner_id: me,
    description: params.description ?? null,
    generated: params.generated ?? false,
    generator_model: params.generator_model ?? null,
    generator_meta: params.generator_meta ?? null,
  };
  if (params.visibility) {
    seriesInsert.visibility = params.visibility === "leaders" ? "leaders" : params.visibility;
  }

  const { data: s, error: sErr } = await supabase.from("study_series").insert(seriesInsert).select("*").single();
  if (sErr) throw new Error(sErr.message);

  const rows = params.sections.map((sec, i) => ({
    series_id: (s as any).id,
    title: sec.title || `Week ${i + 1}`,
    content: sec.body_md,
    position: sec.day_index ?? i + 1,
    created_by: me,
  }));

  const { data: entries, error: eErr } = await supabase
    .from("study_entries")
    .insert(rows)
    .select("*")
    .order("position", { ascending: true });
  if (eErr) throw new Error(eErr.message);

  return {
    series: { ...(s as any), section_count: entries?.length ?? 0, is_bookmarked: false } as StudySeries,
    entries: (entries || []) as StudyEntry[],
  };
}
