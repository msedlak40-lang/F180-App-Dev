// webapp/src/services/groups.ts
import { supabase } from '../lib/supabaseClient';

/* ────────────────────────────────────────────────────────────────────────────
   Types
──────────────────────────────────────────────────────────────────────────── */

export type GroupStatus = 'pending' | 'approved' | 'denied' | 'archived';
export type GroupRole = 'member' | 'leader';

export type MyGroup = {
  id: string;
  name: string | null;
  status: GroupStatus;
  role: GroupRole | null;
  location: string | null;
  meeting_day: string | null;
  meeting_time: string | null;       // PostgREST returns TIME as string
  meeting_timezone: string | null;
};

export type PendingGroup = {
  group_id: string;
  name: string | null;
  created_at: string;
  owner_id: string | null;
  owner_name: string | null;
  location: string | null;
  meeting_day: string | null;
  meeting_time: string | null;       // TIME string
  meeting_timezone: string | null;
  attending_hint: string | null;
};

/* ────────────────────────────────────────────────────────────────────────────
   Member-facing helpers
──────────────────────────────────────────────────────────────────────────── */

/** List groups the current user belongs to (with your role). */
export async function listMyGroups(): Promise<MyGroup[]> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return [];

  // Join group_members → groups to get your role + group metadata
  const { data, error } = await supabase
    .from('group_members')
    .select('role, groups(id, name, status, location, meeting_day, meeting_time, meeting_timezone)')
    .eq('user_id', uid);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as any[];
  const out: MyGroup[] = rows
    .map((r) => {
      const g = r.groups || {};
      return {
        id: g.id as string,
        name: (g.name ?? null) as string | null,
        status: (g.status ?? 'approved') as GroupStatus,
        role: (r.role ?? null) as GroupRole | null,
        location: (g.location ?? null) as string | null,
        meeting_day: (g.meeting_day ?? null) as string | null,
        meeting_time: (g.meeting_time ?? null) as string | null,
        meeting_timezone: (g.meeting_timezone ?? null) as string | null,
      };
    })
    .filter((g) => !!g.id);

  return out;
}

/** Fetch a single group (only if you have access via RLS). */
export async function getGroup(groupId: string): Promise<MyGroup | null> {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, status, location, meeting_day, meeting_time, meeting_timezone')
    .eq('id', groupId)
    .single();

  if (error) {
    if ((error as any).code === 'PGRST116') return null; // not found
    throw new Error(error.message);
  }

  // We don’t know your role from this select; null is fine for read-only contexts
  return {
    id: data.id,
    name: data.name ?? null,
    status: (data.status ?? 'approved') as GroupStatus,
    role: null,
    location: data.location ?? null,
    meeting_day: data.meeting_day ?? null,
    meeting_time: (data.meeting_time ?? null) as string | null,
    meeting_timezone: data.meeting_timezone ?? null,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   Group request / approvals (RPC wrappers)
   Requires GA-1 SQL (grp_request / grp_admin_* / fn_is_org_admin)
──────────────────────────────────────────────────────────────────────────── */

/** Request a new group (status=pending). Returns new group id. */
export async function requestGroup(opts: {
  name: string;
  location?: string;
  meeting_day?: string;
  meeting_time?: string;        // "HH:MM"
  meeting_timezone?: string;
  attending_hint?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('grp_request', {
    p_name: opts.name,
    p_location: opts.location ?? null,
    p_meeting_day: opts.meeting_day ?? null,
    p_meeting_time: opts.meeting_time ?? null,
    p_meeting_tz: opts.meeting_timezone ?? null,
    p_attending_hint: opts.attending_hint ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/** Returns true if the current user is an org owner/admin. */
export async function isOrgAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('fn_is_org_admin', {});
  if (error) return false;
  return !!data;
}

/** Back-compat for GroupSelector: create a group by name.
 *  Now routes through the approvals flow (status = 'pending'). */
export async function createGroupByName(name: string): Promise<string> {
  return await requestGroup({ name });
}

/** List pending group requests (admins only). */
export async function adminListGroupRequests(): Promise<PendingGroup[]> {
  const { data, error } = await supabase.rpc('grp_admin_list_requests', {});
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    group_id: r.group_id,
    name: r.name,
    created_at: r.created_at,
    owner_id: r.owner_id,
    owner_name: r.owner_name,
    location: r.location,
    meeting_day: r.meeting_day,
    meeting_time: r.meeting_time,
    meeting_timezone: r.meeting_timezone,
    attending_hint: r.attending_hint,
  })) as PendingGroup[];
}

/** Approve a pending group (admins only). */
export async function adminApproveGroup(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('grp_admin_approve', { p_group_id: groupId });
  if (error) throw new Error(error.message);
}

/** Deny a pending group with an optional reason (admins only). */
export async function adminDenyGroup(groupId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('grp_admin_deny', {
    p_group_id: groupId,
    p_reason: reason ?? null,
  });
  if (error) throw new Error(error.message);
}
