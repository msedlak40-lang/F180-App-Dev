import React from 'react';
import { acceptInvite, type AcceptStudyInviteResult } from '../services/study';

function useHashQuery() {
  const [q, setQ] = React.useState(() => new URLSearchParams(window.location.hash.split('?')[1] || ''));
  React.useEffect(() => {
    const onHash = () => setQ(new URLSearchParams(window.location.hash.split('?')[1] || ''));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return q;
}

export default function AcceptStudyInvite() {
  const q = useHashQuery();
  const [status, setStatus] = React.useState<'idle' | 'working' | 'success' | 'error'>('idle');
  const [err, setErr] = React.useState<string | null>(null);
  const [res, setRes] = React.useState<AcceptStudyInviteResult | null>(null);

  React.useEffect(() => {
    const token = q.get('token');
    if (!token) {
      setStatus('error');
      setErr('Invite token missing.');
      return;
    }
    (async () => {
      setStatus('working');
      setErr(null);
      try {
        const out = await acceptInvite(token);
        setRes(out);
        setStatus('success');
        // Auto-redirect after a moment
        setTimeout(() => {
          window.location.hash = `#/group/${out.group_id}/study?series=${encodeURIComponent(out.series_id)}`;
        }, 900);
      } catch (e: any) {
        setErr(e?.message ?? 'Failed to accept invite');
        setStatus('error');
      }
    })();
  }, [q]);

  return (
    <div className="max-w-xl mx-auto mt-10 rounded-2xl border bg-white p-6">
      <div className="text-lg font-semibold mb-2">Join Study</div>
      {status === 'working' && <div className="text-sm opacity-80">Accepting your invite…</div>}
      {status === 'error' && (
        <div className="text-sm text-red-600">
          {err ?? 'Something went wrong.'}
          <div className="mt-2">
            <button className="text-sm underline" onClick={() => window.history.back()}>Go back</button>
          </div>
        </div>
      )}
      {status === 'success' && res && (
        <div className="text-sm">
          You’re in! Role: <span className="font-medium">{res.role}</span>.
          <div className="mt-2">
            Redirecting to the study…{' '}
            <button
              className="text-sm underline"
              onClick={() => {
                window.location.hash = `#/group/${res.group_id}/study?series=${encodeURIComponent(res.series_id)}`;
              }}
            >
              Go now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
