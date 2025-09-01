// src/services/groupMembers.ts
// Centralized helpers for group member + invite actions.
// Non-breaking: only new named exports. No other files are modified yet.

import { supabase } from "../lib/supabaseClient";

export type GroupRole = "leader" | "member" | string;

type RpcCandidate = readonly [name: string, args: Record<string, any>];

async function tryRpc(candidates: ReadonlyArray<RpcCandidate>) {
  let lastErr: any = null;
  for (const [name, args] of candidates) {
    try {
      const { error } = await supabase.rpc(name, args as any);
      if (!error) return { ok: true as const, name };
      lastErr = error;
    } catch (e) {
      lastErr = e;
    }
  }
  return { ok: false as const, err: lastErr ?? new Error("No matching RPC found.") };
}

/** Invite a member by email. */
export async function inviteMember(groupId: string, email: string): Promise<void> {
  const tried = await tryRpc([
    ["grp_invite_member", { p_group_id: groupId, p_email: email }],
    ["group_invite_member", { p_group_id: groupId, p_email: email }],
    ["admin_invite_member", { p_group_id: groupId, p_email: email }],
  ]);
  if (!tried.ok) throw tried.err;
}

/** Resend an invite by id; falls back to re-sending by email if provided. */
export async function resendInvite(args: { inviteId?: string; groupId?: string; email?: string }): Promise<void> {
  const { inviteId, groupId, email } = args;
  const candidates: RpcCandidate[] = [];
  if (inviteId) {
    candidates.push(["grp_resend_invite", { p_invite_id: inviteId }]);
    candidates.push(["group_resend_invite", { p_invite_id: inviteId }]);
  }
  if (groupId && email) {
    // fallback: send a fresh invite
    candidates.push(["grp_invite_member", { p_group_id: groupId, p_email: email }]);
    candidates.push(["group_invite_member", { p_group_id: groupId, p_email: email }]);
  }
  const tried = await tryRpc(candidates);
  if (!tried.ok) throw tried.err;
}

/** Cancel (revoke) an invite by id. */
export async function cancelInvite(inviteId: string): Promise<void> {
  const tried = await tryRpc([
    ["grp_cancel_invite", { p_invite_id: inviteId }],
    ["group_cancel_invite", { p_invite_id: inviteId }],
    ["admin_cancel_group_invite", { p_invite_id: inviteId }],
  ]);
  if (!tried.ok) throw tried.err;
}

/** Remove a member from a group. */
export async function removeMember(groupId: string, userId: string): Promise<void> {
  const tried = await tryRpc([
    ["grp_remove_member", { p_group_id: groupId, p_user_id: userId }],
    ["group_remove_member", { p_group_id: groupId, p_user_id: userId }],
    ["admin_remove_group_member", { p_group_id: groupId, p_user_id: userId }],
  ]);
  if (!tried.ok) throw tried.err;
}

/** Leave current group as the logged-in user. */
export async function leaveGroup(groupId: string): Promise<void> {
  const tried = await tryRpc([
    ["grp_leave_group", { p_group_id: groupId }],
    ["group_leave", { p_group_id: groupId }],
    ["member_leave_group", { p_group_id: groupId }],
  ]);
  if (!tried.ok) throw tried.err;
}

/** Promote/demote a member’s role. */
export async function setMemberRole(groupId: string, userId: string, role: GroupRole): Promise<void> {
  const tried = await tryRpc([
    ["grp_set_member_role", { p_group_id: groupId, p_user_id: userId, p_role: role }],
    ["group_set_member_role", { p_group_id: groupId, p_user_id: userId, p_role: role }],
    ["admin_set_member_role", { p_group_id: groupId, p_user_id: userId, p_role: role }],
  ]);
  if (!tried.ok) throw tried.err;
}

/** Check if a user can manage the group (leader or org admin). */
export async function isGroupAdmin(groupId: string, userId: string): Promise<boolean> {
  try {
    // Preferred: call your SQL helper (should exist from B1).
    const { data, error } = await supabase.rpc("is_group_admin", { uid: userId, gid: groupId });
    if (!error && typeof data === "boolean") return data;

    // Fallback: check if they’re a leader in this group (RLS permitting).
    const { data: gm, error: gmErr } = await supabase
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!gmErr && gm?.role === "leader") return true;

    // Otherwise, unknown/false.
    return false;
  } catch {
    return false;
  }
}
