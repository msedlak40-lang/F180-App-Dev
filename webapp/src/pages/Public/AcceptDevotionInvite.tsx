import React from 'react';
import { acceptInvite } from '../../services/devotions';
import AuthBar from '../../components/AuthBar';
import { supabase } from '../../lib/supabaseClient';

function useInviteToken(): string | null {
  // We expect: #/accept-devotion-invite?token=abc
  const [token, setToken] = React.useState<string | null>(null);
  React.useEffect(() => {
    const hash = window.location.hash || '';
    const [, qs] = hash.split('?');
    const params = new URLSearchParams(qs || '');
    setToken(params.get('token'));
  }, []);
  return token;
}

export default function AcceptDevotionInvite() {
  const token = useInviteToken();
  const [session, setSession] = React.useState<any>(null);
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const doAccept = async () => {
    if (!token) { setError('Missing token'); return; }
    if (!session) { setError('Please sign in first'); return; }
    setBusy(true); setError(null); setStatus(null);
    try {
      await acceptInvite(token);
      setStatus('You are now a collaborator on this series.');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to accept invite');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto p-4 space-y-4">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Fireside</h1>
        </header>

        <div className="rounded-2xl border p-4 bg-white">
          <h2 className="text-lg font-semibold">Accept Devotion Invite</h2>
          <p className="text-sm opacity-80 mt-1">
            Join a devotional series as a collaborator using this invite link.
          </p>

          <div className="mt-3">
            <div className="text-sm"><span className="opacity-70">Token:</span> <code>{token ?? '(none)'}</code></div>
          </div>

          <div className="mt-4">
            <AuthBar />
          </div>

          <div className="mt-3">
            <button
              className="rounded-xl border px-3 py-2 text-sm hover:shadow-sm disabled:opacity-60"
              onClick={doAccept}
              disabled={busy || !token || !session}
            >
              {busy ? 'Accepting…' : 'Accept Invite'}
            </button>
          </div>

          {status && <div className="mt-3 text-sm text-green-700">{status}</div>}
          {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

          {status && (
            <div className="mt-3">
              <a
                className="text-sm underline"
                href="#/"
                onClick={() => { window.location.hash = '#/'; }}
              >
                Go to app
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
