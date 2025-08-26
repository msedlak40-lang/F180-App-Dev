import React from 'react';
import { supabase } from '../lib/supabaseClient';

function getParam(name: string) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name) || new URLSearchParams(window.location.hash.slice(1)).get(name);
}

export default function AuthBar() {
  const [email, setEmail] = React.useState('');
  const [user, setUser] = React.useState<any>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(true);

  // 1) On load: pick up magic-link redirects (?token_hash&type=...)
  React.useEffect(() => {
    (async () => {
      try {
        // If redirected back with token_hash, finalize the session
        const token_hash = getParam('token_hash');
        const type = (getParam('type') as any) || undefined; // magiclink | recovery | invite | signup | email_change
        if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({ token_hash, type });
          if (error) throw error;
          // Clean the URL so params don't linger
          window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
        }

        const { data } = await supabase.auth.getUser();
        setUser(data.user ?? null);
      } catch (e: any) {
        setErr(e?.message ?? 'Auth error');
      } finally {
        setBusy(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUser(session?.user ?? null);
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  // 2) Send magic link
  const sendLink = async () => {
    setErr(null);
    setMsg(null);
    if (!email.trim()) return;
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          // Where the email will return the user after they click the link:
          emailRedirectTo: window.location.origin, // e.g. http://localhost:5173 or your Netlify URL
          shouldCreateUser: true,
        },
      });
      if (error) throw error;
      setMsg('Check your email for a sign-in link.');
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to send link');
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  if (busy) return null;

  return (
    <div className="rounded-2xl border p-4 bg-white">
      {!user ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col">
            <label className="text-sm">Email</label>
            <input
              className="rounded-xl border px-3 py-2"
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <button onClick={sendLink} className="rounded-xl border px-3 py-2 hover:shadow-sm">
            Send magic link
          </button>
          {msg && <div className="text-sm text-green-700">{msg}</div>}
          {err && <div className="text-sm text-red-600">{err}</div>}
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="text-sm">
            Signed in as <span className="font-medium">{user.email}</span>
          </div>
          <button onClick={signOut} className="rounded-xl border px-3 py-2 hover:shadow-sm">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
