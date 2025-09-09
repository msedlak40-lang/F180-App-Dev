import * as React from "react";
import { supabase } from "../lib/supabaseClient";

/** Read a URL param from either ?query or the #/ hash fragment */
function getParam(name: string) {
  const url = new URL(window.location.href);
  const fromSearch = url.searchParams.get(name);
  if (fromSearch) return fromSearch;
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const [, queryStr] = hash.split("?");
  return queryStr ? new URLSearchParams(queryStr).get(name) : null;
}

export default function AuthBarF180() {
  const [email, setEmail] = React.useState("");
  const [user, setUser] = React.useState<any>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(true);

  // Redirect target: works on localhost and production
  const origin = React.useMemo(() => window.location.origin, []);
  const redirectTo = React.useMemo(() => `${origin}/#/login`, [origin]);

  // 1) On load: complete magic-link if redirected back with token_hash, then fetch user
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token_hash = getParam("token_hash");
        const type = (getParam("type") as any) || undefined; // magiclink | recovery | invite | signup | email_change
        if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({ token_hash, type });
          if (error) throw error;
          // Clean URL (remove token params) and land on Home
          window.history.replaceState({}, document.title, `${origin}/#/`);
        }
        const { data } = await supabase.auth.getUser();
        if (mounted) setUser(data.user ?? null);
      } catch (e: any) {
        if (mounted) setErr(e?.message ?? "Auth error");
      } finally {
        if (mounted) setBusy(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [origin]);

  // 2) Send magic link
  const sendLink = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErr(null);
    setMsg(null);
    const target = email.trim();
    if (!target) return;
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: target,
        options: { emailRedirectTo: redirectTo }, // <-- key fix
      });
      if (error) throw error;
      setMsg(`Check ${target} for your sign-in link.`);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to send link");
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setMsg(null);
    setErr(null);
  };

  if (busy) return null;

  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] p-4 md:p-5">
      {!user ? (
        <form onSubmit={sendLink} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs uppercase tracking-wide opacity-70 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] px-3 py-2 outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] placeholder:opacity-60"
            />
          </div>

          <button
            type="submit"
            className="rounded-xl px-4 py-2 bg-[hsl(var(--primary))] text-white font-medium hover:opacity-90 active:opacity-80 transition"
          >
            Send magic link
          </button>

          {msg && <div className="text-sm text-emerald-400">{msg}</div>}
          {err && <div className="text-sm text-red-400">{err}</div>}
        </form>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm opacity-90">
            Signed in as <span className="font-medium">{user.email}</span>
          </div>
          <div className="flex gap-2">
            <a
              href="#/"
              className="rounded-xl px-3 py-2 bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] hover:bg-[hsl(var(--card))] transition"
            >
              Go to Home
            </a>
            <button
              onClick={signOut}
              className="rounded-xl px-3 py-2 bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] hover:bg-[hsl(var(--card))] transition"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
