import React from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  inviteMember as svcInviteMember,
  resendInvite as svcResendInvite,
  cancelInvite as svcCancelInvite,
  removeMember as svcRemoveMember,
  leaveGroup as svcLeaveGroup,
  setMemberRole as svcSetMemberRole,
  isGroupAdmin as svcIsGroupAdmin,
  type GroupRole as Role,
} from "../../services/groupMembers";

type Profile = {
  id: string;
  display_name?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
};

type MemberRow = {
  user_id: string;
  role: Role;
  created_at?: string | null;
  display_name?: string | null; // demo fallback
  email?: string | null;        // demo fallback
  profile?: Profile;
};

type InviteRow = Record<string, any> & {
  id?: string;
  group_id?: string;
  status?: string | null;
  created_at?: string | null;
};

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2 py-0.5 text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">
      {children}
    </span>
  );
}

export default function GroupMembersPageF180({
  groupId,
  groupName: groupNameProp,
}: {
  groupId: string;
  groupName?: string;
}) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  const [groupName, setGroupName] = React.useState<string | null>(groupNameProp ?? null);

  const [members, setMembers] = React.useState<MemberRow[]>([]);
  const [invites, setInvites] = React.useState<InviteRow[]>([]);
  const [q, setQ] = React.useState(""); // search query

  // auth + permissions
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [canManage, setCanManage] = React.useState(false); // leader or org-admin

  // Demo mode
  const [isDemo, setIsDemo] = React.useState(false);

  // Invite modal
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteSending, setInviteSending] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        setCurrentUserId(data.user?.id ?? null);
      } catch {
        setCurrentUserId(null);
      }
    })();
  }, []);

  React.useEffect(() => {
    // Enable demo via /#/group/{id}/members-f180?demo=1
    try {
      const hash =
        typeof window !== "undefined" && window.location && typeof window.location.hash === "string"
          ? window.location.hash
          : "";
      const qIndex = hash.indexOf("?");
      const qs = qIndex >= 0 ? hash.slice(qIndex + 1) : "";
      const p = new URLSearchParams(qs);
      const demo = p.get("demo");
      if (demo === "1" || demo === "true") {
        enableDemo();
      } else {
        load();
      }
    } catch {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, groupNameProp]);

  async function load() {
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      // 1) Group name (if not passed in)
      if (!groupNameProp) {
        const { data: gData, error: gErr } = await supabase
          .from("groups")
          .select("name")
          .eq("id", groupId)
          .single();
        if (!gErr) setGroupName(gData?.name ?? null);
      } else {
        setGroupName(groupNameProp);
      }

      // 2) Members
      const { data: mData, error: mErr } = await supabase
        .from("group_members")
        .select("user_id, role, created_at")
        .eq("group_id", groupId);
      if (mErr) throw mErr;
      const ms: MemberRow[] = (mData ?? []) as any;

      // 3) Profiles for those member ids
      const memberIds = ms.map((m) => m.user_id).filter(Boolean);
      let profilesById: Record<string, Profile> = {};
      if (memberIds.length) {
        const { data: pData, error: pErr } = await supabase
          .from("profiles")
          .select("id, display_name, full_name, first_name, last_name, email")
          .in("id", memberIds);
        if (pErr) throw pErr;
        profilesById = Object.fromEntries((pData ?? []).map((p: any) => [p.id, p as Profile]));
      }

      const mergedMembers = ms
        .map((m) => ({ ...m, profile: profilesById[m.user_id] }))
        .sort((a, b) => Number(b.role === "leader") - Number(a.role === "leader"));

      // 4) Invites (schema-agnostic)
      const { data: iData, error: iErr } = await supabase
        .from("group_invitations")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });
      if (iErr) throw iErr;

      setMembers(mergedMembers);
      setInvites(((iData ?? []) as any[]).slice());

      // 5) Can current user manage? (leader or org-admin)
      try {
        const amLeader =
          (currentUserId && mergedMembers.some((m) => m.user_id === currentUserId && m.role === "leader")) ||
          false;
        const amAdmin = currentUserId
          ? await svcIsGroupAdmin(groupId, currentUserId)
          : false;
        setCanManage(amLeader || amAdmin);
      } catch {
        setCanManage(false);
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load members");
    } finally {
      setLoading(false);
    }
  }

  function enableDemo() {
    setIsDemo(true);
    setGroupName(groupNameProp ?? "Demo Group");
    const demoMembers: MemberRow[] = [
      { user_id: "u_aaron", role: "leader", display_name: "Aaron Brooks", email: "aaron@example.com" },
      { user_id: "u_james", role: "member", display_name: "James Carter", email: "jcarter@example.com" },
      { user_id: "u_paul", role: "member", display_name: "Paul Bennett", email: "pbennett@example.com" },
    ];
    const merged = demoMembers.sort((a, b) => Number(b.role === "leader") - Number(a.role === "leader"));
    const demoInvites: InviteRow[] = [
      { id: "inv_1", group_id: groupId, email: "newguy@example.com", status: "pending", created_at: new Date().toISOString() },
    ];
    setMembers(merged);
    setInvites(demoInvites);
    setCanManage(true);
    setLoading(false);
  }

  // ---------- Actions (now using services) ----------

  async function sendInvite(email: string) {
    setInviteSending(true);
    setMsg(null);
    setError(null);
    try {
      if (isDemo) {
        await new Promise((r) => setTimeout(r, 300));
        setInvites((v) => [
          { id: `demo_${Date.now()}`, group_id: groupId, email, status: "pending", created_at: new Date().toISOString() },
          ...v,
        ]);
        setMsg("✅ Demo: invite queued (not saved).");
      } else {
        await svcInviteMember(groupId, email);
        setMsg("✅ Invite sent.");
        await load();
      }
      setInviteOpen(false);
      setInviteEmail("");
    } catch (e: any) {
      setError(e?.message ?? "Failed to send invite");
    } finally {
      setInviteSending(false);
    }
  }

  async function resendInvite(inv: InviteRow) {
    setError(null);
    setMsg(null);
    try {
      if (isDemo) {
        // just update created_at to "now"
        setInvites((list) => list.map((i) => (i.id === inv.id ? { ...i, created_at: new Date().toISOString() } : i)));
        setMsg("✅ Demo: invite 'resent'.");
        return;
      }
      const email =
        inv.email ?? inv.invitee_email ?? inv.invite_email ?? inv.recipient_email ?? inv.user_email ?? undefined;

      await svcResendInvite({ inviteId: inv.id, groupId, email });
      setMsg("✅ Invite resent.");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to resend invite");
    }
  }

  async function cancelInvite(inv: InviteRow) {
    if (!window.confirm("Cancel this invitation?")) return;
    setError(null);
    setMsg(null);
    try {
      if (isDemo) {
        setInvites((list) => list.filter((i) => i.id !== inv.id));
        setMsg("✅ Demo: invite canceled.");
        return;
      }
      await svcCancelInvite(String(inv.id));
      setMsg("✅ Invite canceled.");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to cancel invite");
    }
  }

  async function removeMember(userId: string) {
    if (!window.confirm("Remove this member from the group?")) return;
    setError(null);
    setMsg(null);
    try {
      if (isDemo) {
        setMembers((list) => list.filter((m) => m.user_id !== userId));
        setMsg("✅ Demo: member removed.");
        return;
      }
      await svcRemoveMember(groupId, userId);
      setMsg("✅ Member removed.");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to remove member");
    }
  }

  async function leaveGroup() {
    if (!window.confirm("Leave this group?")) return;
    setError(null);
    setMsg(null);
    try {
      if (isDemo) {
        setMembers((list) => list.filter((m) => m.user_id !== currentUserId));
        setMsg("✅ Demo: you left the group.");
        return;
      }
      await svcLeaveGroup(groupId);
      setMsg("✅ You left the group.");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to leave group");
    }
  }

  // C3: set role (promote/demote)
  async function setRole(userId: string, newRole: Role) {
    setError(null);
    setMsg(null);
    try {
      if (isDemo) {
        setMembers((list) =>
          list
            .map((m) => (m.user_id === userId ? { ...m, role: newRole } : m))
            .sort((a, b) => Number(b.role === "leader") - Number(a.role === "leader"))
        );
        setMsg(`✅ Demo: role updated to ${newRole}.`);
        return;
      }
      await svcSetMemberRole(groupId, userId, newRole);
      setMsg("✅ Role updated.");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to change role");
    }
  }

  function promote(userId: string) {
    return setRole(userId, "leader");
  }
  function demote(userId: string) {
    // prevent demoting the last leader
    const leaders = members.filter((m) => m.role === "leader");
    if (leaders.length <= 1 && leaders[0]?.user_id === userId) {
      setError("You can’t demote the last leader of this group.");
      return;
    }
    return setRole(userId, "member");
  }

  // ---------- helpers ----------

  const totalMembers = members.length;
  const pendingInvites = invites.filter((i) => (i.status ?? "pending") === "pending").length;
  const headerName = groupName ?? "Group";

  function nicify(local?: string | null) {
    if (!local) return "";
    return local
      .replace(/[._-]+/g, " ")
      .split(" ")
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
      .join(" ")
      .trim();
  }

  function memberDisplay(m: MemberRow) {
    const emailLocal = (m.profile?.email ?? "").split("@")[0] ?? "";
    const autoFromEmail = nicify(emailLocal);

    // If display_name looks auto-generated from email and we have a proper full_name, prefer full_name
    if (m.profile?.full_name && (m.profile?.display_name ?? "") === autoFromEmail) {
      return m.profile.full_name;
    }

    return (
      m.profile?.display_name ||
      m.profile?.full_name ||
      [m.profile?.first_name, m.profile?.last_name].filter(Boolean).join(" ") ||
      m.display_name ||
      m.email ||
      m.user_id
    );
  }
  function memberEmail(m: MemberRow) {
    return m.profile?.email || m.email || null;
  }
  function inviteEmailOf(i: InviteRow) {
    return i.email ?? i.invitee_email ?? i.invite_email ?? i.recipient_email ?? i.user_email ?? "—";
  }

  const myMembership = currentUserId ? members.find((m) => m.user_id === currentUserId) : undefined;
  const canLeave = Boolean(myMembership); // allow anyone in the group to leave

  // C3: search filtering (names/emails/role)
  const term = q.trim().toLowerCase();
  const filteredMembers = React.useMemo(() => {
    if (!term) return members;
    return members.filter((m) => {
      const hay = [memberDisplay(m), memberEmail(m) ?? "", m.role ?? ""].join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [members, term]);

  const filteredInvites = React.useMemo(() => {
    if (!term) return invites;
    return invites.filter((i) => inviteEmailOf(i).toLowerCase().includes(term));
  }, [invites, term]);

  return (
    <div className="f180 space-y-5">
      {/* Header */}
      <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 md:p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-lg font-semibold tracking-tight text-[hsl(var(--card-foreground))]">
              Group Members — <span className="opacity-90">{headerName}</span>
            </div>
            <Pill>{totalMembers} members</Pill>
            <Pill>
              {pendingInvites} pending invite{pendingInvites === 1 ? "" : "s"}
            </Pill>
            {isDemo && (
              <span className="inline-flex items-center rounded-full bg-indigo-400/10 px-2 py-0.5 text-[11px] leading-4 text-indigo-300 border border-indigo-300/20">
                Demo
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, role…"
              className="h-9 w-56 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--popover))] px-3 text-sm text-[hsl(var(--popover-foreground))] placeholder:text-white/50"
            />
            {canLeave && (
              <button
                className="h-9 rounded-lg border border-[hsl(var(--border))] bg-transparent px-3 text-sm text-white/80 hover:bg-white/10"
                onClick={leaveGroup}
              >
                Leave group
              </button>
            )}
            <button
              className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
              onClick={() => setInviteOpen(true)}
              disabled={!canManage}
              title={canManage ? "" : "You don’t have permission to invite"}
            >
              Invite by email
            </button>
            <label className="inline-flex items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))]">
              <input
                type="checkbox"
                checked={isDemo}
                onChange={(e) => (e.target.checked ? enableDemo() : load())}
              />
              Demo mode
            </label>
          </div>
        </div>
        <div className="text-[11px] text-white/50">Group ID: {groupId}</div>
      </div>

      {/* Messages */}
      {msg && (
        <div className="rounded-[var(--radius)] border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">
          {msg}
        </div>
      )}
      {error && (
        <div className="rounded-[var(--radius)] border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] p-4 bg-[hsl(var(--card))] space-y-3 animate-pulse">
          <div className="h-4 w-40 bg-white/10 rounded" />
          <div className="h-4 w-56 bg-white/10 rounded" />
          <div className="h-4 w-32 bg-white/10 rounded" />
        </div>
      ) : (
        <>
          {/* Members */}
          <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] overflow-hidden">
            <div className="bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] px-4 py-2 text-sm font-medium">
              Members
              {term && (
                <span className="ml-2 text-[11px] text-white/60">
                  ({filteredMembers.length} match{filteredMembers.length === 1 ? "" : "es"})
                </span>
              )}
            </div>
            <div className="bg-[hsl(var(--card))] divide-y divide-[hsl(var(--border))]">
              {filteredMembers.length === 0 ? (
                <div className="px-4 py-3 text-sm text-white/70">No members{term ? " match your search." : " yet."}</div>
              ) : (
                filteredMembers.map((m) => {
                  const isSelf = currentUserId && m.user_id === currentUserId;
                  const isLeader = m.role === "leader";
                  const leadersCount = members.filter((mm) => mm.role === "leader").length;
                  const canDemote = isLeader && (leadersCount > 1 || !isSelf); // block demoting last leader
                  return (
                    <div
                      key={m.user_id}
                      className="px-4 py-3 flex items-center gap-3 text-sm text-[hsl(var(--card-foreground))]"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{memberDisplay(m)}</div>
                        {memberEmail(m) && (
                          <div className="text-[11px] text-white/60 truncate">
                            {memberEmail(m)}
                          </div>
                        )}
                      </div>
                      <div className="ml-auto flex items-center gap-2">
                        <Pill>{m.role}</Pill>
                        {canManage && !isSelf && (
                          <>
                            {isLeader ? (
                              <button
                                className="h-8 rounded-md border border-[hsl(var(--border))] bg-transparent px-3 text-xs text-white/80 hover:bg-white/10 disabled:opacity-50"
                                onClick={() => demote(m.user_id)}
                                disabled={!canDemote}
                                title={!canDemote ? "Cannot demote the last leader" : "Demote to member"}
                              >
                                Demote
                              </button>
                            ) : (
                              <button
                                className="h-8 rounded-md border border-[hsl(var(--border))] bg-transparent px-3 text-xs text-white/80 hover:bg-white/10"
                                onClick={() => promote(m.user_id)}
                                title="Promote to leader"
                              >
                                Promote
                              </button>
                            )}
                            <button
                              className="h-8 rounded-md border border-[hsl(var(--border))] bg-transparent px-3 text-xs text-white/80 hover:bg-white/10"
                              onClick={() => removeMember(m.user_id)}
                              title="Remove member"
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Invites */}
          <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] overflow-hidden">
            <div className="bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] px-4 py-2 text-sm font-medium">
              Pending invites
              {term && (
                <span className="ml-2 text-[11px] text-white/60">
                  ({filteredInvites.length} match{filteredInvites.length === 1 ? "" : "es"})
                </span>
              )}
            </div>
            <div className="bg-[hsl(var(--card))] divide-y divide-[hsl(var(--border))]">
              {filteredInvites.length === 0 ? (
                <div className="px-4 py-3 text-sm text-white/70">No pending invites{term ? " match your search." : "."}</div>
              ) : (
                filteredInvites.map((i) => {
                  const email = inviteEmailOf(i);
                  return (
                    <div
                      key={i.id ?? `${email}-${i.created_at}`}
                      className="px-4 py-3 flex items-center gap-3 text-sm text-[hsl(var(--card-foreground))]"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{email}</div>
                        <div className="text-[11px] text-white/60">
                          {(i.status ?? "pending")} · {i.created_at ? new Date(i.created_at).toLocaleString() : ""}
                        </div>
                      </div>
                      <div className="ml-auto flex items-center gap-2">
                        <button
                          className="h-8 rounded-md border border-[hsl(var(--border))] bg-transparent px-3 text-xs text-white/80 hover:bg-white/10"
                          onClick={() => resendInvite(i)}
                          disabled={!canManage}
                          title={canManage ? "Resend invite" : "You don’t have permission"}
                        >
                          Resend
                        </button>
                        <button
                          className="h-8 rounded-md border border-[hsl(var(--border))] bg-transparent px-3 text-xs text-red-200 hover:bg-red-500/10"
                          onClick={() => cancelInvite(i)}
                          disabled={!canManage}
                          title={canManage ? "Cancel invite" : "You don’t have permission"}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* Invite Modal */}
      {inviteOpen && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60" onClick={() => setInviteOpen(false)} />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 text-[hsl(var(--card-foreground))] shadow-2xl">
            <div className="text-base font-semibold">Invite to {headerName}</div>
            <div className="mt-3 space-y-1.5">
              <label className="text-xs text-white/70">Email address</label>
              <input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="name@example.com"
                className="h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--popover))] px-3 text-sm text-[hsl(var(--popover-foreground))] placeholder:text-white/50"
              />
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 text-sm hover:bg-[hsl(var(--muted))]"
                onClick={() => setInviteOpen(false)}
                disabled={inviteSending}
              >
                Cancel
              </button>
              <button
                className="h-9 rounded-lg bg-white/90 text-black px-3 text-sm disabled:opacity-50"
                onClick={() => sendInvite(inviteEmail.trim())}
                disabled={inviteSending || !inviteEmail.trim()}
              >
                {inviteSending ? "Sending…" : isDemo ? "Demo send" : "Send invite"}
              </button>
            </div>
            <div className="mt-2 text-[11px] text-white/50">
              {isDemo
                ? "Demo mode: no email will be sent."
                : "An email invitation will be sent if your RPC is configured."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
