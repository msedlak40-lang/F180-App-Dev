import { supabase } from '../lib/supabaseClient';

export type DevotionVisibility = 'private' | 'leaders' | 'group';

export type DevSeries = {
  id: string;
  title: string;
  description: string | null;
  visibility: DevotionVisibility;
  owner_id: string;
  is_automated: boolean;
  created_at: string;
};

export type ScriptureRef = { reference: string; text: string };

export type DevEntry = {
  id: string;
  day_index: number;
  scheduled_date: string | null; // YYYY-MM-DD
  status: 'draft' | 'scheduled' | 'published' | string;
  title: string;
  body_md: string;
  scriptures: ScriptureRef[];
  author_id: string;
  created_at: string;
  published_at: string | null;
};

// --- Series ---
export async function listSeriesForGroup(groupId: string): Promise<DevSeries[]> {
  const { data, error } = await supabase.rpc('dev_list_series_for_group', { p_group_id: groupId });
  if (error) throw new Error(error.message);
  return (data ?? []) as DevSeries[];
}

export async function createSeries(
  groupId: string | null,
  title: string,
  description?: string | null,
  visibility: DevotionVisibility = 'group'
): Promise<string> {
  const { data, error } = await supabase.rpc('dev_create_series', {
    p_group_id: groupId,
    p_title: title,
    p_description: description ?? null,
    p_visibility: visibility,
  });
  if (error) throw new Error(error.message);
  return data as string; // series_id
}

export async function updateSeries(
  seriesId: string,
  patch: Partial<{
    title: string;
    description: string | null;
    visibility: DevotionVisibility;
    start_date: string | null; // YYYY-MM-DD
    timezone: string | null;
    is_automated: boolean;
    generator_config: any;
  }>
) {
  const { error } = await supabase.rpc('dev_update_series', {
    p_series_id: seriesId,
    p_title: patch.title ?? null,
    p_description: patch.description ?? null,
    p_visibility: patch.visibility ?? null,
    p_start_date: patch.start_date ?? null,
    p_timezone: patch.timezone ?? null,
    p_is_automated: patch.is_automated ?? null,
    p_generator_config: patch.generator_config ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function deleteSeries(seriesId: string) {
  const { error } = await supabase.rpc('dev_delete_series', { p_series_id: seriesId });
  if (error) throw new Error(error.message);
}

// --- Entries ---
export async function listEntries(seriesId: string): Promise<DevEntry[]> {
  const { data, error } = await supabase.rpc('dev_list_entries', { p_series_id: seriesId });
  if (error) throw new Error(error.message);
  return (data ?? []) as DevEntry[];
}

export async function addEntry(
  seriesId: string,
  dayIndex: number,
  title: string,
  bodyMd: string,
  options?: {
    scriptures?: ScriptureRef[];
    status?: 'draft' | 'scheduled' | 'published';
    scheduled_date?: string | null; // YYYY-MM-DD
  }
): Promise<string> {
  const { data, error } = await supabase.rpc('dev_add_entry', {
    p_series_id: seriesId,
    p_day_index: dayIndex,
    p_title: title,
    p_body_md: bodyMd,
    p_scriptures: options?.scriptures ?? [],
    p_status: options?.status ?? 'draft',
    p_scheduled_date: options?.scheduled_date ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string; // entry_id
}

export async function updateEntry(
  entryId: string,
  patch: Partial<{
    day_index: number;
    title: string;
    body_md: string;
    scriptures: ScriptureRef[];
    status: 'draft' | 'scheduled' | 'published';
    scheduled_date: string | null;
  }>
) {
  const { error } = await supabase.rpc('dev_update_entry', {
    p_entry_id: entryId,
    p_day_index: patch.day_index ?? null,
    p_title: patch.title ?? null,
    p_body_md: patch.body_md ?? null,
    p_scriptures: patch.scriptures ?? null,
    p_status: patch.status ?? null,
    p_scheduled_date: patch.scheduled_date ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function deleteEntry(entryId: string) {
  const { error } = await supabase.rpc('dev_delete_entry', { p_entry_id: entryId });
  if (error) throw new Error(error.message);
}

// --- Reads + Subs (stubs for later UI steps) ---
export async function markRead(entryId: string) {
  const { error } = await supabase.rpc('dev_mark_read', { p_entry_id: entryId });
  if (error) throw new Error(error.message);
}

export type GeneratedDevotion = {
  title: string;
  body_md: string;
  scriptures: ScriptureRef[];
};

export async function generateDevotion(
  mode: 'title' | 'assist',
  title: string,
  notes?: string
): Promise<GeneratedDevotion> {
  const { data, error } = await supabase.functions.invoke('generate-devotion', {
    body: { mode, title, notes },
  });
  if (error) throw new Error(error.message ?? 'Failed to generate devotion');
  return data as GeneratedDevotion;
}

// ---- Collaborators ----
export type DevCollaborator = {
  user_id: string;
  role: 'editor' | 'viewer';
  email: string;
  display_name: string;
};

export async function listCollaborators(seriesId: string): Promise<DevCollaborator[]> {
  const { data, error } = await supabase.rpc('dev_list_collaborators', { p_series_id: seriesId });
  if (error) throw new Error(error.message);
  return (data ?? []) as DevCollaborator[];
}

export async function addCollaboratorByEmail(
  seriesId: string,
  email: string,
  role: 'editor' | 'viewer' = 'editor'
) {
  const { error } = await supabase.rpc('dev_add_collaborator_by_email', {
    p_series_id: seriesId,
    p_email: email,
    p_role: role,
  });
  if (error) throw new Error(error.message);
}

export async function removeCollaboratorByUser(seriesId: string, userId: string) {
  const { error } = await supabase.rpc('dev_remove_collaborator_by_user', {
    p_series_id: seriesId,
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
}

// ---- Invite links ----
export type DevInvite = {
  id: string;
  token: string;
  role: 'editor' | 'viewer';
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export async function createInviteLink(
  seriesId: string,
  role: 'editor' | 'viewer' = 'editor',
  expiresInDays = 7,
  maxUses = 1
): Promise<{ invite_id: string; token: string; expires_at: string | null }> {
  const { data, error } = await supabase.rpc('dev_create_invite_link', {
    p_series_id: seriesId,
    p_role: role,
    p_expires_in_days: expiresInDays,
    p_max_uses: maxUses,
  });
  if (error) throw new Error(error.message);
  // rpc returns a row { invite_id, token, expires_at }
  return data as any;
}

export async function listInvites(seriesId: string): Promise<DevInvite[]> {
  const { data, error } = await supabase.rpc('dev_list_invites', { p_series_id: seriesId });
  if (error) throw new Error(error.message);
  return (data ?? []) as DevInvite[];
}

export async function revokeInvite(inviteId: string) {
  const { error } = await supabase.rpc('dev_revoke_invite', { p_invite_id: inviteId });
  if (error) throw new Error(error.message);
}

export async function acceptInvite(token: string) {
  const { error } = await supabase.rpc('dev_accept_invite', { p_token: token });
  if (error) throw new Error(error.message);
}

export async function mySeriesCapabilities(seriesId: string): Promise<{
  can_read: boolean; can_edit: boolean; my_role: string | null;
}> {
  const { data, error } = await supabase.rpc('dev_my_series_capabilities', { p_series_id: seriesId });
  if (error) throw new Error(error.message);
  // RPC returns a single row
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? { can_read: false, can_edit: false, my_role: null }) as any;
}

// ===== Multi-day generation via Edge Function =====
export type SeriesDraftItem = {
  title: string;
  body_md: string;
  scriptures?: { reference: string; text: string }[];
};

export async function generateDevotionSeries(
  theme: string,
  days: number,
  notes?: string,
  tone?: string
) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-devotion-series`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ theme, days, notes, tone }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Edge function error ${res.status}: ${text}`);
  }
  const json = await res.json();
  const items = Array.isArray(json?.items) ? json.items : [];
  if (!items.length) throw new Error('No draft items returned');
  return items as SeriesDraftItem[];
}

// ===== Bulk insert entries (auto-scheduled) =====
export async function bulkAddEntries(
  seriesId: string,
  startDate: string, // 'YYYY-MM-DD'
  items: SeriesDraftItem[],
  cadenceDays = 1
) {
  const { data, error } = await supabase.rpc('dev_bulk_add_entries', {
    p_series_id: seriesId,
    p_start_date: startDate,
    p_items: items,
    p_cadence_days: cadenceDays,
  });
  if (error) throw new Error(error.message);
  return (data ?? 0) as number;
}

// ===== Subscriptions (email/SMS) =====
export async function subscribeSeries(seriesId: string, channel: 'email' | 'sms' = 'email') {
  const { error } = await supabase.rpc('dev_subscribe_series', {
    p_series_id: seriesId,
    p_channel: channel,
  });
  if (error) throw new Error(error.message);
}

export async function unsubscribeSeries(seriesId: string, channel: 'email' | 'sms' = 'email') {
  const { error } = await supabase.rpc('dev_unsubscribe_series', {
    p_series_id: seriesId,
    p_channel: channel,
  });
  if (error) throw new Error(error.message);
}

export async function mySubscriptions(seriesId: string): Promise<Array<'email' | 'sms'>> {
  const { data, error } = await supabase
    .from('devotion_series_subscriptions')
    .select('channel')
    .eq('series_id', seriesId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => r.channel) as Array<'email' | 'sms'>;
}

export async function createInviteLinkSimple(
  seriesId: string,
  role: 'editor' | 'viewer',
  email?: string
): Promise<{ id: string; token: string; role: 'editor' | 'viewer'; email_lock: string | null }> {
  const { data, error } = await supabase.rpc('dev_create_invite_link_simple', {
    p_series_id: seriesId,
    p_role: role,
    p_email: (email || '').trim() || null,
  });
  if (error) throw new Error(error.message);
  // RPC returns a table; Supabase JS will give an array
  const row = Array.isArray(data) ? data[0] : data;
  return row as any;
}
