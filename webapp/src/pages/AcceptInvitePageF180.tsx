import * as React from "react";
import { supabase } from "../lib/supabaseClient";

type InviteRow = {
  id: string;
  group_id: string;
  email: string | null;
  role: string | null;       // enum in DB; treat as string here
  status: string | null;     // 'pending' | 'accepted' | 'revoked' | 'expired' | null
  expires_at: string | null;
};

function getTokenFromHash(): string | null {
  try {
    const raw = (typeof window !== "undefined" ? window.location.hash : "") || "";
    const [, queryStr] = raw.replace(/^#/, "").split("?");
    const params = new URLSearchParams(queryStr || "");
    const t = params.get("token");
    return t && t.trim() ? t.trim() : null;
  } catch {
    return null;
  }
}

export default function AcceptInvitePageF180() {
  const [token] = React.useState<string | null>(() => getTokenFromHash());
  const [loading, setLoading] = React.useState(true);
  const [userEmail, setUserEmail] = React.useState<string>("");
  const [authedEmail, setAuthedEmail] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  // After accept
  const [acceptedGroupId, setAcceptedGroupId] = React.useState<string | null>(null);

  // 1) Load auth
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!mounted) return;
        const email = data.user?.email ?? null;
        setAuthedEmail(email);
        if (email) setUserEmail(email);
      } catch {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // 2) If already signed in and have a token, attempt auto-accept
  React.useEffect(() => {
    if (!token || !authedEmail) return;
    void acceptNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, authedEmail]);

  async function acceptNow() {
    setErr(null);
    setMsg("Checking your invitation…");

    try {
      if (!token) {
        setErr("Missing invite token.");
        setMsg(null);
        return;
      }

      // Fetch the invite row by token (RLS allows invitee to select)
      const { data: inv, error: invErr } = await supabase
        .from("group_invitations")
        .select("id, group_id, email, role, status, expires_at")
        .eq("invite_token", token)
        .single<InviteRow>();

      if (invErr || !inv) {
        setErr("Invite not found or no longer valid.");
        setMsg(null);
        return;
      }

      // Must be signed in
      const { data: me } = await supabase.auth.getUser();
      const email = (me?.user?.email || "").toLowerCase();
      if (!email) {
        setErr("You need to sign in to accept the invite.");
        setMsg(null);
        return;
      }

      // Email must match the invite email
      const invEmail = (inv.email || "").toLowerCase();
      if (!invEmail || invEmail !== email) {
        setErr("This invite was sent to a different email address.");
        setMsg(null);
        return;
      }

      // Status and expiry checks
      if (inv.status && inv.status !== "pending") {
        setErr(`This invite is ${inv.status}.`);
        setMsg(null);
        return;
      }
      if (inv.expires_at && new Date(inv.expires_at).getTime() <= Date.now()) {
        setErr("This invite has expired.");
        setMsg(null);
        return;
      }

      // Insert membership (idempotent) — RLS policy "insert via invite" allows this while status=pending
      const role = inv.role || "member";
      const { error: upErr } = await supabase
        .from("group_members")
        .upsert(
          { group_id: inv.group_id, user_id: me!.user!.id, role },
          { onConflict: "group_id,user_id", ignoreDuplicates: true }
        );
      if (upErr) {
        setErr("Failed to add you to the group.");
        setMsg(null);
        return;
      }

      // Mark invite accepted & clear token (invitee allowed by RLS update policy)
      const { error: updErr } = await supabase
        .from("group_invitations")
        .update({ status: "accepted", accepted_by: me!.user!.id, invite_token: null })
        .eq("id", inv.id);
      if (updErr) {
        // Not fatal for user experience; they are already in the group.
        console.warn("Invite update failed:", updErr);
      }

      setAcceptedGroupId(inv.group_id);
      setMsg("You’re in! Redirecting to your group…");

      // Gentle redirect after a moment
      setTimeout(() => {
        window.location.hash = `#/group/${inv.group_id}/devotions`;
      }, 900);
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong while accepting your invite.");
      setMsg(null);
    }
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg("Sending you a sign-in link…");
    try {
      if (!token) {
        setErr("Missing invite token.");
        setMsg(null);
        return;
      }
      const email = userEmail.trim();
      if (!email) {
        setErr("Please enter your email.");
        setMsg(null);
        return;
      }

      const redirectTo = `${window.location.origin}/#/accept-invite?token=${encodeURIComponent(
        token
      )}`;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) {
        setErr(error.message || "Failed to send sign-in link.");
        setMsg(null);
        return;
      }
      setMsg("Check your email for the sign-in link. After you sign in, we’ll finish adding you to the group.");
    } catch (e: any) {
      setErr(e?.message ?? "Could not send sign-in link.");
      setMsg(null);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-xl md:text-2xl font-semibold tracking-tight mb-4">Accept Invitation</h1>

      {!token && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          This link is missing its token. Please use the link from your email.
        </div>
      )}

      {err && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {err}
        </div>
      )}
      {msg && (
        <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          {msg}
        </div>
      )}

      {loading ? (
        <div className="text-sm opacity-70">Loading…</div>
      ) : authedEmail ? (
        <div className="space-y-3">
          <div className="text-sm text-[hsl(var(--muted-foreground))]">
            Signed in as <span className="font-medium">{authedEmail}</span>.
          </div>
          <button
            className="rounded-lg bg-white/90 text-black px-3 py-2 text-sm"
            onClick={acceptNow}
            disabled={!token}
            title="Accept this invite"
          >
            Accept invite
          </button>

          {acceptedGroupId && (
            <div className="text-sm">
              If you’re not redirected,{" "}
              <a className="underline" href={`#/group/${acceptedGroupId}/devotions`}>
                open your group
              </a>.
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={sendMagicLink} className="space-y-3">
          <div className="text-sm text-[hsl(var(--muted-foreground))]">
            Enter the email address that received the invite. We’ll send you a sign-in link and then add you to the group.
          </div>
          <input
            type="email"
            className="h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm outline-none"
            placeholder="you@email.com"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
          />
          <button
            className="rounded-lg bg-white/90 text-black px-3 py-2 text-sm"
            type="submit"
            disabled={!token || !userEmail.trim()}
          >
            Send me a sign-in link
          </button>
        </form>
      )}
    </div>
  );
}
