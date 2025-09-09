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
  created_at: string;
  profile?: Profile | null;
};

type InviteRow = {
  id: string;
  group_id: string;
  email: string;
  invited_by: string | null;
  status: "pending" | "accepted" | "revoked" | "expired" | null;
  created_at: string;
};

function Bool<T>(x: T | null | undefined): x is T {
  return !!x;
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 px-2 py-0.5 text-[11px]">
      {children}
    </span>
  );
}

export default function GroupMembersPageF180(props: {
  groupId: string;
  groupName?: string | null;
}) {
  const { groupId, groupName: groupNameProp = null } = props;

  // page state
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  const [groupName, setGroupName] = React.useState<string | null>(groupNameProp ?? null);

  const [members, setMembers] = React.useState<MemberRow[]>([]);
  const [invites, setInvites] = React.useState<InviteRow[]>([]);
  const [q, setQ] = React.useState(""); // search query

  // auth + permissions
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [canManage, setCanManage] = React.useState(false); // leader/owner or org-admin

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
      const params = new URLSearchParams(hash.split("?")[1] || "");
      const demo = params.get("demo");
      if (demo === "1") {
        enableDemo();
        return;
      }
    } catch {
      // ignore
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, currentUserId]);

  async function load() {
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      // 1) Group name if not provided
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
        (pData ?? []).forEach((p: any) => {
          profilesById[p.id] = p;
        });
      }

      const mergedMembers: MemberRow[] = ms.map((m) => ({
        ...m,
        profile: profilesById[m.user_id] ?? null,
      }));

      // 4) Invitations
      const { data: iData, error: iErr } = await supabase
        .from("group_invitations")
        .select("id, group_id, email, invited_by, status, created_at")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });
      if (iErr) throw iErr;

      setMembers(mergedMembers);
      setInvites(((iData ?? []) as any[]).slice());

      // 5) Can current user manage? (leader or owner, plus org-admin if available)
      {
        const amLeader =
          (currentUserId &&
            mergedMembers.some(
              (m) =>
                m.user_id === currentUserId &&
                (m.role === "leader" || m.role === "owner")
            )) || false;

        let amAdmin = false;
        if (currentUserId) {
          try {
            amAdmin = await svcIsGroupAdmin(groupId, currentUserId);
          } catch (e) {
            console.warn("svcIsGroupAdmin failed; continuing with leader/owner only:", e);
            amAdmin = false;
          }
        }
        setCanManage(amLeader || amAdmin);
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load members");
    } finally {
      setLoading(false);
    }
  }

  function enableDemo() {
    setIsDemo(true);
    setGroupName(groupNameProp ?? "North KC | John Smith");
    const demoMembers: MemberRow[] = [
      {
        user_id: "u_me",
        role: "leader" as Role,
        created_at: new Date().toISOString(),
        profile: {
          id: "u_me",
          display_name: "You (Leader)",
          email: "you@example.com",
        },
      },
      {
        user_id: "u_1",
        role: "member" as Role,
        created_at: new Date(Date.now() - 3600_000).toISOString(),
        profile: { id: "u_1", display_name: "Mark S.", email: "mark@demo.com" },
      },
      {
        user_id: "u_2",
        role: "member" as Role,
        created_at: new Date(Date.now() - 7200_000).toISOString(),
        profile: { id: "u_2", display_name: "Jake T.", email: "jake@demo.com" },
      },
    ];
    const demoInvites: InviteRow[] = [
      {
        id: "i_1",
        group_id: groupId,
        email: "invitee@demo.com",
        invited_by: "u_me",
        status: "pending",
        created_at: new Date().toISOString(),
      },
    ];
    setMembers(demoMembers);
    setInvites(demoInvites);
    setCanManage(true);
    setLoading(false);
  }

  // ---------- Helpers: email function invoke ----------

  async function sendInviteEmail(group_id: string, email: string) {
    const { data, error } = await supabase.functions.invoke("send-invite-email", {
      body: { group_id, email },
    });
    if (error) throw new Error(error.message ?? "Failed to send invite email");
    return data;
  }

  async function resendInviteEmail(invitation_id: string) {
    const { data, error } = await supabase.functions.invoke("send-invite-email", {
      body: { invitation_id },
    });
    if (error) throw new Error(error.message ?? "Failed to resend invite email");
    return data;
  }

  // ---------- Actions (using services + email function) ----------

  async function sendInvite(email: string) {
    setInviteSending(true);
    setMsg(null);
    setError(null);
    try {
      if (isDemo) {
        await new Promise((r) => setTimeout(r, 300));
        setInvites((v) => [
          { id: "i_demo", group_id: groupId, email, invited_by: "u_me", status: "pending", created_at: new Date().toISOString() },
          ...v,
        ]);
        setMsg("✅ Demo: invite queued (not saved).");
      } else {
        // 1) Create/ensure the invite exists in DB (your existing service)
        await svcInviteMember(groupId, email);

        // 2) Send the email via Edge Function (handles token + link)
        await sendInviteEmail(groupId, email);

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

  async function resendInvite(inviteId: string) {
    setMsg(null);
    setError(null);
    try {
      if (isDemo) {
        await new Promise((r) => setTimeout(r, 300));
        setMsg("✅ Demo: resend queued.");
      } else {
        // (optional) keep your DB 'resend' bookkeeping
        await svcResendInvite(inviteId);

        // Send email again via Edge Function
        await resendInviteEmail(inviteId);

        setMsg("✅ Invite resent.");
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to resend invite");
    }
  }

  async function cancelInvite(inviteId: string) {
    setMsg(null);
    setError(null);
    try {
      if (isDemo) {
        setInvites((v) => v.filter((i) => i.id !== inviteId));
        setMsg("✅ Demo: invite canceled.");
      } else {
        await svcCancelInvite(inviteId);
        setMsg("✅ Invite canceled.");
        await load();
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to cancel invite");
    }
  }

  async function removeMember(userId: string) {
    setMsg(null);
    setError(null);
    try {
      if (isDemo) {
        setMembers((v) => v.filter((m) => m.user_id !== userId));
        setMsg("✅ Demo: member removed.");
      } else {
        await svcRemoveMember(groupId, userId);
        setMsg("✅ Member removed.");
        await load();
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to remove member");
    }
  }

  async function leaveGroup() {
    setMsg(null);
    setError(null);
    try {
      if (isDemo) {
        setMsg("✅ Demo: you left the group.");
      } else if (currentUserId) {
        await svcLeaveGroup(groupId, currentUserId);
        setMsg("✅ You left the group.");
        await load();
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to leave group");
    }
  }

  async function setRole(userId: string, role: Role) {
    setMsg(null);
    setError(null);
    try {
      if (isDemo) {
        setMembers((v) =>
          v.map((m) => (m.user_id === userId ? { ...m, role } : m))
        );
        setMsg("✅ Demo: role updated.");
      } else {
        await svcSetMemberRole(groupId, userId, role);
        setMsg("✅ Role updated.");
        await load();
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to set role");
    }
  }

  // ---------- Render ----------

  const filteredMembers = members.filter((m) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    const p = m.profile;
    const fields = [
      p?.display_name,
      p?.full_name,
      p?.first_name,
      p?.last_name,
      p?.email,
      m.role,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return fields.includes(needle);
  });

  const hasPendingInvites = invites.some((i) => i.status === "pending");

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Members</h1>
          <div className="text-sm text-[hsl(var(--muted-foreground))]">
            {groupName ? groupName : "Group"}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            className="h-9 min-w-[220px] rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm outline-none"
            placeholder="Search members…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="flex items-center gap-2">
            {hasPendingInvites && (
              <Pill>Pending invites: {invites.filter((i) => i.status === "pending").length}</Pill>
            )}
            <button
              className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 px-3 text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
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
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}
      {msg && (
        <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          {msg}
        </div>
      )}

      {loading ? (
        <div className="text-sm opacity-70">Loading…</div>
      ) : (
        <>
          {/* Members list */}
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-[hsl(var(--border))] px-4 py-2 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              <div>Member</div>
              <div>Role</div>
              <div>Actions</div>
            </div>
            <div className="divide-y divide-[hsl(var(--border))]">
              {filteredMembers.length === 0 ? (
                <div className="px-4 py-4 text-sm text-[hsl(var(--muted-foreground))]">
                  No members match your search.
                </div>
              ) : (
                filteredMembers.map((m) => {
                  const p = m.profile;
                  return (
                    <div key={m.user_id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm">
                          {p?.display_name || p?.full_name || p?.email || m.user_id}
                        </div>
                        <div className="truncate text-[11px] text-[hsl(var(--muted-foreground))]">
                          {p?.email || "—"}
                        </div>
                      </div>
                      <div className="text-sm">
                        <Pill>{m.role}</Pill>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="rounded border border-[hsl(var(--border))] px-2 py-1 text-xs hover:bg-[hsl(var(--muted))]"
                          disabled={!canManage}
                          title={!canManage ? "You don’t have permission" : ""}
                          onClick={() => setRole(m.user_id, m.role === "member" ? ("leader" as Role) : ("member" as Role))}
                        >
                          {m.role === "member" ? "Promote → Leader" : "Demote → Member"}
                        </button>
                        <button
                          className="rounded border border-[hsl(var(--border))] px-2 py-1 text-xs hover:bg-[hsl(var(--muted))]"
                          disabled={!canManage}
                          title={!canManage ? "You don’t have permission" : ""}
                          onClick={() => removeMember(m.user_id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Invites */}
          <div className="mt-6 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-2">
              <div className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Invitations
              </div>
            </div>
            <div className="divide-y divide-[hsl(var(--border))]">
              {invites.length === 0 ? (
                <div className="px-4 py-4 text-sm text-[hsl(var(--muted-foreground))]">
                  No invitations yet.
                </div>
              ) : (
                invites.map((i) => {
                  return (
                    <div key={i.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm">{i.email}</div>
                        <div className="truncate text-[11px] text-[hsl(var(--muted-foreground))]">
                          {new Date(i.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <Pill>{i.status ?? "unknown"}</Pill>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="rounded border border-[hsl(var(--border))] px-2 py-1 text-xs hover:bg-[hsl(var(--muted))]"
                          disabled={!canManage}
                          title={!canManage ? "You don’t have permission" : ""}
                          onClick={async () => {
                            try {
                              await svcResendInvite(i.id); // optional bookkeeping
                              await resendInviteEmail(i.id); // actual email
                              setMsg("✅ Invite resent.");
                            } catch (e: any) {
                              setError(e?.message ?? "Failed to resend invite");
                            }
                          }}
                        >
                          Resend
                        </button>
                        <button
                          className="rounded border border-[hsl(var(--border))] px-2 py-1 text-xs hover:bg-[hsl(var(--muted))]"
                          disabled={!canManage}
                          title={!canManage ? "You don’t have permission" : ""}
                          onClick={() => cancelInvite(i.id)}
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

          {/* Leave group */}
          <div className="mt-6 flex items-center justify-end">
            <button
              className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 px-3 py-1.5 text-sm"
              onClick={leaveGroup}
            >
              Leave group
            </button>
          </div>
        </>
      )}

      {/* Invite Modal */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50">
          <div className="w-[min(520px,calc(100vw-24px))] rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-lg">
            <div className="mb-3 text-base font-medium">Invite a member</div>
            <div className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
              We’ll email them a secure link to join <strong>{groupName ?? "your group"}</strong>.
            </div>
            <div className="flex items-center gap-2">
              <input
                className="h-9 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm outline-none"
                placeholder="name@email.com"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <button
                className="h-9 rounded-lg border border-[hsl(var(--border))] px-3 text-sm"
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
          </div>
        </div>
      )}
    </div>
  );
}
