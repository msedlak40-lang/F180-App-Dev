import React from 'react';
import { listGroupJournals, type JournalItem } from '../../services/journals';

export default function JournalTab({ groupId }: { groupId: string }) {
  const [items, setItems] = React.useState<JournalItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<'all' | 'mine'>('all');
  const [q, setQ] = React.useState('');

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const rows = await listGroupJournals(groupId);
      setItems(rows);
    } catch (e:any) {
      setError(e?.message ?? 'Failed to load journals');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { if (groupId) load(); }, [groupId]);

  const filtered = items.filter(it => {
    if (filter === 'mine' && !it.is_me) return false;
    if (!q.trim()) return true;
    const hay = `${it.reference ?? ''} ${it.observation_text ?? ''} ${it.application_text ?? ''} ${it.prayer_text ?? ''}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="rounded-2xl border p-4 bg-white shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Journal</h2>
          <div className="flex items-center gap-2">
            <input
              className="rounded-xl border px-3 py-2 text-sm"
              placeholder="Search journal…"
              value={q}
              onChange={(e)=>setQ(e.target.value)}
            />
            <select
              className="rounded-xl border px-3 py-2 text-sm"
              value={filter}
              onChange={(e)=>setFilter(e.target.value as any)}
            >
              <option value="all">All</option>
              <option value="mine">Mine</option>
            </select>
            <button className="text-sm underline" onClick={load}>Refresh</button>
          </div>
        </div>
        {loading && <div className="mt-2 text-sm opacity-70">Loading…</div>}
        {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
      </div>

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-2xl border p-4 bg-white text-sm opacity-80">
          No journal entries yet.
        </div>
      )}

      {filtered.map((it) => (
        <div key={it.id} className="rounded-2xl border p-4 bg-white shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm opacity-70">{new Date(it.created_at).toLocaleString()}</div>
              <div className="text-sm mt-1 flex items-center gap-2">
                {it.is_me && <span className="px-2 py-0.5 text-xs rounded-full border bg-gray-50">You</span>}
                <span className={`px-2 py-0.5 text-xs rounded-full border ${it.visibility === 'group' ? 'bg-blue-50' : 'bg-gray-50'}`}>
                  {it.visibility === 'group' ? 'Group-visible' : 'Private'}
                </span>
              </div>
            </div>
            <div className="text-sm opacity-80">{it.reference ?? '—'}</div>
          </div>

          {it.observation_text && (
            <div className="mt-3">
              <div className="text-sm font-medium">Observation (I Believe)</div>
              <p className="text-sm">{it.observation_text}</p>
            </div>
          )}
          {it.application_text && (
            <div className="mt-3">
              <div className="text-sm font-medium">Application (I Will)</div>
              <p className="text-sm">{it.application_text}</p>
            </div>
          )}
          {it.prayer_text && (
            <div className="mt-3">
              <div className="text-sm font-medium">Prayer</div>
              <p className="text-sm">{it.prayer_text}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
