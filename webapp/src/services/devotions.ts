// webapp/src/services/devotions.ts
import { supabase } from '../lib/supabaseClient';

/* ===================== Types ===================== */

export type DevotionVisibility = 'group' | 'leaders' | 'private';

export type DevSeries = {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  visibility: DevotionVisibility;
  created_at: string;
};

export type DevEntry = {
  id: string;
  series_id: string;
  day_index: number;
  title: string;
  body_md: string | null;
  status: 'draft' | 'scheduled' | 'published';
  scheduled_date: string | null; // YYYY-MM-DD
  created_at: string;
};

// Accept a collaborator invite by token
export async function acceptInvite(token: string): Promise<void> {
  const { error } = await supabase.rpc('dev_accept_invite', { p_token: token });
  if (error) throw new Error(error.message);
}

export type DevCollaborator = {
  user_id: string;
  role: 'editor' | 'viewer';
  display_name: string | null;
  email: string | null;
};

export type DevInvite = {
  id: string;
  token: string;
  role: 'editor' | 'viewer';
  email_lock: string | null;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type GeneratedDevotion = {
  title: string;
  body_md: string;
  scriptures?: { reference: string; text: string }[];
};

export type SeriesDraftItem = {
  title: string;
  body_md: string;
  scriptures?: { reference: string; text: string }[];
};

/* ===================== Series ===================== */

export async function listSeriesForGroup(groupId: string): Promise<DevSeries[]> {
  const { data, error } = await supabase
    .from('devotion_series')
    .select('id, group_id, title, description, visibility, created_at')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as DevSeries[];
}

export async function createSeries(
  groupId: string,
  title: string,
  description: string | null,
  visibility: DevotionVisibility
): Promise<void> {
  const { error } = await supabase.from('devotion_series').insert({
    group_id: groupId,
    title,
    description,
    visibility,
  });
  if (error) throw new Error(error.message);
}

export async function updateSeries(
  seriesId: string,
  fields: Partial<Pick<DevSeries, 'title' | 'description' | 'visibility'>>
): Promise<void> {
  const { error } = await supabase.from('devotion_series').update(fields).eq('id', seriesId);
  if (error) throw new Error(error.message);
}

export async function deleteSeries(seriesId: string): Promise<void> {
  const { error } = await supabase.from('devotion_series').delete().eq('id', seriesId);
  if (error) throw new Error(error.message);
}

/* ===================== Entries ===================== */

export async function listEntries(seriesId: string): Promise<DevEntry[]> {
  const { data, error } = await supabase
    .from('devotion_entries')
    .select('id, series_id, day_index, title, body_md, status, scheduled_date, author_id, created_at')
    .eq('series_id', seriesId)
    .order('day_index', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as DevEntry[];
}

// Create a new devotion entry
export async function addEntry(
  seriesId: string,
  dayIndex: number,
  title: string,
  bodyMd: string,
  options?: {
    status?: 'draft' | 'scheduled' | 'published';
    scheduled_date?: string | null;
    scriptures?: { reference: string; text: string }[];
  }
): Promise<void> {
  const insert: Record<string, any> = {
    series_id: seriesId,
    day_index: dayIndex,
    title,
    body_md: bodyMd,
    status: options?.status ?? 'draft',
    scheduled_date: options?.scheduled_date ?? null,
  };

  if (options?.scriptures && Array.isArray(options.scriptures) && options.scriptures.length > 0) {
    insert.scriptures = options.scriptures; // retries below if column doesn't exist
  }

  let { error } = await supabase.from('devotion_entries').insert(insert);
  if (error) {
    if (/column .*scriptures/i.test(error.message)) {
      delete insert.scriptures;
      const retry = await supabase.from('devotion_entries').insert(insert);
      if (retry.error) throw new Error(retry.error.message);
    } else {
      throw new Error(error.message);
    }
  }
}

export async function updateEntry(
  entryId: string,
  fields: Partial<Pick<DevEntry, 'day_index' | 'title' | 'body_md' | 'status' | 'scheduled_date'>>
): Promise<void> {
  const { error } = await supabase.from('devotion_entries').update(fields).eq('id', entryId);
  if (error) throw new Error(error.message);
}

export async function deleteEntry(entryId: string): Promise<void> {
  const { error } = await supabase.from('devotion_entries').delete().eq('id', entryId);
  if (error) throw new Error(error.message);
}

/* ========= Multi-day generator bulk insert ========= */

//export async function bulkAddEntries(
  //seriesId: string,
  //startDate: string, // YYYY-MM-DD
 // drafts: SeriesDraftItem[],
 // cadenceDays = 1
//): Promise<number> {
 // const start = new Date(`${startDate}T00:00:00`);
 // if (isNaN(start.getTime())) throw new Error('Invalid start date');
 // const cadence = Math.max(1, cadenceDays);

 // const rows = drafts.map((d, idx) => {
  //  const dt = new Date(start);
  //  dt.setDate(dt.getDate() + idx * cadence);
   // const y = dt.getFullYear();
   // const m = String(dt.getMonth() + 1).padStart(2, '0');
   // const day = String(dt.getDate()).padStart(2, '0');
   // const sched = `${y}-${m}-${day}`;
   // const row: Record<string, any> = {
   //   series_id: seriesId,
   //   day_index: idx + 1,
   //   title: d.title,
   //   body_md: d.body_md,
   //   status: 'scheduled',
  //    scheduled_date: sched,
 //   };
 //  if (Array.isArray(d.scriptures) && d.scriptures.length) row.scriptures = d.scriptures;
 //   return row;
 // });

  //let { data, error } = await supabase.from('devotion_entries').insert(rows).select('id');
 // if (error) {
   // if (/column .*scriptures/i.test(error.message)) {
  //    rows.forEach((r) => delete r.scriptures);
  //    const retry = await supabase.from('devotion_entries').insert(rows).select('id');
  //    if (retry.error) throw new Error(retry.error.message);
  //    return retry.data?.length ?? 0;
  //  }
   // throw new Error(error.message);
 // }
 // return data?.length ?? 0;
//}

export async function bulkAddEntries(
  seriesId: string,
  startDate: string | null, // allow null
  drafts: SeriesDraftItem[],
  cadenceIn: number | 'daily' | 'weekly' = 1
): Promise<number> {
  // get current user id for author_id
  const { data: userData, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw new Error(authErr.message);
  const me = userData?.user?.id;
  if (!me) throw new Error('You must be signed in to add entries');

  // normalize cadence to days
  const cadenceDays =
    typeof cadenceIn === 'number'
      ? Math.max(1, cadenceIn)
      : cadenceIn === 'weekly'
      ? 7
      : 1; // 'daily' -> 1

  // helper: safe YYYY-MM-DD or null
  const toSched = (s: string | null, offsetDays: number): string | null => {
    if (!s) return null;
    const d = new Date(`${s}T00:00:00Z`); // force UTC midnight
    if (isNaN(d.getTime())) return null;
    d.setUTCDate(d.getUTCDate() + offsetDays);
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  };

  const rows = drafts.map((d, idx) => {
    const scheduled = toSched(startDate, idx * cadenceDays);
    const row: Record<string, any> = {
      series_id: seriesId,
      author_id: me,                      // ⬅️ required by your NOT NULL constraint
      day_index: d.day_index ?? idx + 1,
      title: d.title,
      body_md: d.body_md ?? '',
      status: scheduled ? 'scheduled' : 'draft',
      scheduled_date: scheduled,          // may be null
    };
    // tolerate optional scriptures field if present in your draft shape
    if (Array.isArray((d as any).scriptures) && (d as any).scriptures.length) {
      row.scriptures = (d as any).scriptures;
    }
    return row;
  });

  let { data, error } = await supabase.from('devotion_entries').insert(rows).select('id');
  if (error) {
    // if your table doesn't have 'scriptures', retry without it
    if (/column .+scriptures/i.test(error.message)) {
      rows.forEach((r) => delete r.scriptures);
      const retry = await supabase.from('devotion_entries').insert(rows).select('id');
      if (retry.error) throw new Error(retry.error.message);
      return retry.data?.length ?? 0;
    }
    throw new Error(error.message);
  }
  return data?.length ?? 0;
}



/* ===================== Collaborators ===================== */

export async function listCollaborators(seriesId: string): Promise<DevCollaborator[]> {
  // 1) fetch collaborators
  const { data: collab, error: e1 } = await supabase
    .from('devotion_collaborators')
    .select('user_id, role')
    .eq('series_id', seriesId);
  if (e1) throw new Error(e1.message);

  const rows = collab ?? [];
  if (rows.length === 0) return [];

  // 2) fetch profiles in one query
  const userIds = rows.map((r) => r.user_id);
  const { data: profiles, error: e2 } = await supabase
    .from('profiles')
    .select('id, display_name, email')
    .in('id', userIds);
  if (e2) throw new Error(e2.message);

  const map = new Map<string, { display_name: string | null; email: string | null }>();
  (profiles ?? []).forEach((p: any) => map.set(p.id, { display_name: p.display_name ?? null, email: p.email ?? null }));

  return rows.map((r: any) => ({
    user_id: r.user_id,
    role: r.role,
    display_name: map.get(r.user_id)?.display_name ?? null,
    email: map.get(r.user_id)?.email ?? null,
  }));
}

export async function removeCollaboratorByUser(seriesId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('devotion_collaborators')
    .delete()
    .match({ series_id: seriesId, user_id: userId });
  if (error) throw new Error(error.message);
}

/* ===================== Invites ===================== */

export async function listInvites(seriesId: string): Promise<DevInvite[]> {
  const { data, error } = await supabase
    .from('devotion_invites')
    .select('id, token, role, email_lock, max_uses, used_count, expires_at, revoked_at, created_at')
    .eq('series_id', seriesId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((r: any) => ({
    ...r,
    role: String(r.role) as 'editor' | 'viewer',
    email_lock: r.email_lock ?? null,
    expires_at: r.expires_at ?? null,
    revoked_at: r.revoked_at ?? null,
  })) as DevInvite[];
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const { error } = await supabase
    .from('devotion_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', inviteId);
  if (error) throw new Error(error.message);
}

// Create a single-use invite link (optionally locked to an email)
export async function createInviteLinkSimple(
  seriesId: string,
  role: 'editor' | 'viewer',
  email?: string
): Promise<{ id: string; token: string; role: string; email_lock: string | null }> {
  const { data, error } = await supabase.rpc('dev_create_invite_link_simple', {
    p_series_id: seriesId,
    p_role: role,
    p_email: email ?? null,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    id: row.id,
    token: row.token,
    role: row.role,
    email_lock: row.email_lock ?? null,
  };
}

/* ===================== Capabilities ===================== */

export async function mySeriesCapabilities(seriesId: string): Promise<{ can_edit: boolean }> {
  // Try RPC if it exists
  try {
    const { data, error } = await supabase.rpc('fn_can_edit_series', { p_series_id: seriesId });
    if (!error && typeof data === 'boolean') return { can_edit: !!data };
  } catch {
    // ignore
  }
  // Fallback: check collaborator role
  const { data: user } = await supabase.auth.getUser();
  const uid = user?.user?.id;
  if (!uid) return { can_edit: false };

  const { data: rows, error } = await supabase
    .from('devotion_collaborators')
    .select('role')
    .match({ series_id: seriesId, user_id: uid })
    .limit(1);
  if (error) return { can_edit: false };
  return { can_edit: (rows?.[0]?.role ?? '') === 'editor' };
}

/* ===================== AI Generation ===================== */

async function invokeFirst<T = any>(names: string[], body: any): Promise<T> {
  let lastErr: any = null;
  for (const name of names) {
    try {
      const { data, error } = await supabase.functions.invoke(name, { body });
      if (!error && data) return data as T;
      lastErr = error;
    } catch (e: any) {
      lastErr = e;
    }
  }
  throw new Error(lastErr?.message || 'AI function not available');
}

export async function generateDevotion(
  mode: 'title' | 'assist',
  title: string,
  notes?: string
): Promise<GeneratedDevotion> {
  const payload = { mode, title, notes: notes ?? null };
  // Try a few common function names depending on your deployment
  return invokeFirst<GeneratedDevotion>(['dev-generate', 'dev_generate', 'devotion-generate'], payload);
}

export async function generateDevotionSeries(
  theme: string,
  days: number,
  notes?: string
): Promise<SeriesDraftItem[]> {
  const payload = { theme, days, notes: notes ?? null };
  return invokeFirst<SeriesDraftItem[]>(
    ['dev-generate-series', 'dev_generate_series', 'devotion-generate-series'],
    payload
  );
}

/* ===================== Subscriptions (email/SMS) ===================== */

export async function mySubscriptions(seriesId: string): Promise<Array<'email' | 'sms'>> {
  try {
    const { data, error } = await supabase.rpc('dev_my_subscriptions', { p_series_id: seriesId });
    if (error) return [];
    // Expecting array of strings like ['email','sms']
    return Array.isArray(data) ? (data as Array<'email' | 'sms'>) : [];
  } catch {
    return [];
  }
}

export async function subscribeSeries(seriesId: string, channel: 'email' | 'sms'): Promise<void> {
  const { error } = await supabase.rpc('dev_subscribe_series', {
    p_series_id: seriesId,
    p_channel: channel,
  });
  if (error) throw new Error(error.message);
}

export async function unsubscribeSeries(seriesId: string, channel: 'email' | 'sms'): Promise<void> {
  const { error } = await supabase.rpc('dev_unsubscribe_series', {
    p_series_id: seriesId,
    p_channel: channel,
  });
  if (error) throw new Error(error.message);
}

/* ===================== Highlights (Devotions) ===================== */

export type DevHighlight = {
  id: string;
  series_id: string;
  entry_id: string;
  user_id: string;
  start_pos: number;
  length: number;
  selected_text: string;
  body_hash: string | null;
  color: 'yellow' | 'green' | 'blue' | 'pink' | 'orange';
  visibility: 'private' | 'group' | 'leaders';
  note: string | null;
  created_at: string;
};

export async function listEntryHighlights(entryId: string): Promise<DevHighlight[]> {
  const { data, error } = await supabase.rpc('dev_list_highlights_for_entry', { p_entry_id: entryId });
  if (error) throw new Error(error.message);
  return (data ?? []) as DevHighlight[];
}

export async function createEntryHighlight(
  entryId: string,
  startPos: number,
  length: number,
  selectedText: string,
  options?: {
    visibility?: 'private' | 'group' | 'leaders';
    color?: 'yellow' | 'green' | 'blue' | 'pink' | 'orange';
    note?: string | null;
    bodyHash?: string | null;
  }
): Promise<string> {
  const { data, error } = await supabase.rpc('dev_create_highlight', {
    p_entry_id: entryId,
    p_start_pos: startPos,
    p_length: length,
    p_selected_text: selectedText,
    p_visibility: options?.visibility ?? 'private',
    p_color: options?.color ?? 'yellow',
    p_note: options?.note ?? null,
    p_body_hash: options?.bodyHash ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function deleteEntryHighlight(highlightId: string): Promise<void> {
  const { error } = await supabase.rpc('dev_delete_highlight', { p_highlight_id: highlightId });
  if (error) throw new Error(error.message);
}

// --- Devotion entry progress (per-user read/archive state) ---

export type DevEntryProgress = {
  entry_id: string;
  series_id: string;
  read_at: string | null;
  archived_at: string | null;
};

/** Map of entry_id -> { read_at, archived_at } for the current user */
export async function getMyProgressForSeries(seriesId: string): Promise<Record<string, DevEntryProgress>> {
  const { data, error } = await supabase
    .from('devotion_entry_progress')
    .select('entry_id, series_id, read_at, archived_at')
    .eq('series_id', seriesId);

  if (error) throw new Error(error.message);
  const map: Record<string, DevEntryProgress> = {};
  (data || []).forEach((row) => (map[row.entry_id] = row));
  return map;
}

/** Mark an entry as read for the current user */
export async function markEntryRead(seriesId: string, entryId: string): Promise<void> {
  // Try update first (works if a row already exists for this user/entry)
  let { error } = await supabase
    .from('devotion_entry_progress')
    .update({ read_at: new Date().toISOString() })
    .eq('entry_id', entryId);

  // If no row existed (or RLS blocked update), insert a new one; trigger sets user_id.
  const { error: insErr } = await supabase
    .from('devotion_entry_progress')
    .insert([{ series_id: seriesId, entry_id: entryId, read_at: new Date().toISOString() }]);

  if (insErr && !/duplicate key value|already exists|unique constraint/i.test(insErr.message)) {
    throw new Error(insErr.message);
  }
}

/** Archive or unarchive an entry for the current user */
export async function toggleArchiveEntry(seriesId: string, entryId: string, archived: boolean): Promise<void> {
  const ts = archived ? new Date().toISOString() : null;

  // Try update first
  let { error } = await supabase
    .from('devotion_entry_progress')
    .update({ archived_at: ts })
    .eq('entry_id', entryId);

  if (!error) return;

  // If row missing, insert baseline with archived state; trigger sets user_id
  const { error: insErr } = await supabase
    .from('devotion_entry_progress')
    .insert([{ series_id: seriesId, entry_id: entryId, read_at: archived ? new Date().toISOString() : null, archived_at: ts }]);

  if (insErr && !/duplicate key value|already exists|unique constraint/i.test(insErr.message)) {
    throw new Error(insErr.message);
  }
}
