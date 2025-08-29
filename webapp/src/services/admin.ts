import { supabase } from '../lib/supabaseClient';

export type PendingGroup = {
  id: string;
  name: string;
  org_id: string;
  created_at: string;
  requested_by: string;
  requested_by_name: string | null;
  requested_by_email: string | null;
};

export async function adminListPendingGroups(): Promise<PendingGroup[]> {
  const { data, error } = await supabase.rpc('admin_list_pending_groups', {});
  if (error) throw new Error(error.message);
  return (data ?? []) as PendingGroup[];
}

export async function adminApproveGroup(
  groupId: string,
  note?: string | null,
  autoAddCreator: boolean = true
): Promise<void> {
  const { error } = await supabase.rpc('admin_approve_group', {
    p_group_id: groupId,
    p_note: note ?? null,
    p_auto_add_creator: autoAddCreator,
  });
  if (error) throw new Error(error.message);
}

export async function adminDenyGroup(groupId: string, reason?: string | null): Promise<void> {
  const { error } = await supabase.rpc('admin_deny_group', {
    p_group_id: groupId,
    p_reason: reason ?? null,
  });
  if (error) throw new Error(error.message);
}
