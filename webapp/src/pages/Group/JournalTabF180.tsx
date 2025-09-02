import React from 'react';
import { supabase } from '../../lib/supabaseClient';

type Journal = {
  id: string;
  group_id: string;
  author_id: string;
  scripture_reference: string | null;
  soap_scripture: string | null;
  soap_observation: string | null;
  soap_application: string | null;
  soap_prayer: string | null;
  visibility: 'group' | 'leader' | 'leaders' | 'private' | string;
  created_at: string;
};

type Props = { groupId: string };

function VisPill({ v }: { v: string }) {
  const value = String(v || '').toLowerCase();

  // Theme-y, readable fills
  const bg =
    value === 'group'
      ? 'bg-indigo-500/20 text-indigo-200 border-indigo-400/30'
      : value === 'leader' || value === 'leaders'
      ? 'bg-amber-500/20 text-amber-200 border-amber-400/30'
      : value === 'private'
      ? 'bg-slate-500/20 text-slate-200 border-slate-400/30'
      : 'bg-slate-500/20 text-slate-200 border-slate-400/30';

  const dot =
    value === 'group'
      ? 'bg-indigo-500'
      : value === 'leader' || value === 'leaders'
      ? 'bg-amber-500'
      : 'bg-slate-500';

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {value}
    </span>
  );
}

function RowSkeleton() {
  return (
    <li className="rounded-2xl border p-4 bg-transparent animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-4 w-40 bg-[hsl(var(--foreground))]/10 rounded" />
        <div className="h-3 w-48 bg-[hsl(var(--foreground))]/10 rounded" />
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-3 w-5/6 bg-[hsl(var(--foreground))]/10 rounded" />
        <div className="h-3 w-2/3 bg-[hsl(var(--foreground))]/10 rounded" />
      </div>
    </li>
  );
}

export default function JournalTab({ groupId }: Props) {
  const [items, setItems] = React.useState<Journal[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // UI state
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  const [q, setQ] = React.useState('');
  const [vis, setVis] = React.useState<'all' | 'group' | 'leader' | 'private'>('all');
  const [sort, setSort] = React.useState<'new' | 'old'>('new');

  const toggle = (id: string) => setOpen((s) => ({ ...s, [id]: !s[id] }));

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('journals')
        .select(
          [
            'id',
            'group_id',
            'author_id',
            'scripture_reference',
            'soap_scripture',
            'soap_observation',
            'soap_application',
            'soap_prayer',
            'visibility',
            'created_at',
          ].join(', ')
        )
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems((data ?? []) as Journal[]);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load journal entries');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // reset UI on group change
    setOpen({});
    setQ('');
    setVis('all');
    setSort('new');
  }, [groupId]);

  // filters + search
  const filtered = React.useMemo(() => {
    let rows = [...items];
    if (vis !== 'all') {
      rows = rows.filter((r) => {
        const v = (r.visibility || '').toString();
        if (vis === 'leader') return v === 'leader' || v === 'leaders';
        return v === vis;
      });
    }
    if (q.trim()) {
      const qq = q.trim().toLowerCase();
      rows = rows.filter((r) => {
        const hay =
          [
            r.scripture_reference,
            r.soap_scripture,
            r.soap_observation,
            r.soap_application,
            r.soap_prayer,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase() || '';
        return hay.includes(qq);
      });
    }
    rows.sort((a, b) =>
      sort === 'new'
        ? +new Date(b.created_at) - +new Date(a.created_at)
        : +new Date(a.created_at) - +new Date(b.created_at)
    );
    return rows;
  }, [items, q, vis, sort]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border p-4 bg-transparent">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold">Journal</div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search Scripture or notes…"
              className="text-sm rounded-lg px-3 py-1.5 bg-[hsl(var(--popover))] text-[hsl(var(--popover-foreground))] border border-[hsl(var(--input))] placeholder:text-[hsl(var(--muted-foreground))]"
            />
            <select
              className="text-sm rounded-lg px-2 py-1.5 bg-[hsl(var(--popover))] text-[hsl(var(--popover-foreground))] border border-[hsl(var(--input))]"
              value={vis}
              onChange={(e) => setVis(e.target.value as any)}
              title="Filter by visibility"
            >
              <option value="all">All</option>
              <option value="group">Group</option>
              <option value="leader">Leader-only</option>
              <option value="private">Private</option>
            </select>
            <select
              className="text-sm rounded-lg px-2 py-1.5 bg-[hsl(var(--popover))] text-[hsl(var(--popover-foreground))] border border-[hsl(var(--input))]"
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              title="Sort"
            >
              <option value="new">Newest</option>
              <option value="old">Oldest</option>
            </select>
            <button className="text-sm underline" onClick={load}>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Loading / error / empty */}
      {loading && (
        <ul className="space-y-3">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </ul>
      )}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-2xl border p-4 bg-transparent text-sm opacity-80">
          No entries match your filters.
        </div>
      )}

      {/* List */}
      <ul className="space-y-3">
        {filtered.map((j) => {
          const isOpen = !!open[j.id];
          return (
            <li key={j.id} className="rounded-2xl border bg-transparent">
              {/* Row header */}
              <button
  className="w-full p-4 flex items-start justify-between gap-3 text-left bg-transparent"
  onClick={() => toggle(j.id)}
  aria-expanded={isOpen}
>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold truncate">
                      {j.scripture_reference || 'Journal Entry'}
                    </div>
                    <VisPill v={(j.visibility || '').toString()} />
                  </div>
                  <div className="text-[11px] opacity-60 mt-0.5">
                    {new Date(j.created_at).toLocaleString()}
                  </div>
                </div>
                {/* Chevron */}
                <svg
                  className={`h-5 w-5 flex-shrink-0 transition-transform ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.08 1.04l-4.25 4.25a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {/* Expanded */}
              {isOpen && (
                <div className="px-4 pb-4 grid gap-3">
                  {j.soap_scripture && (
                    <section className="rounded-xl border bg-transparent p-3">
                      <div className="text-xs font-semibold mb-1">Scripture</div>
                      <div className="text-sm whitespace-pre-wrap">{j.soap_scripture}</div>
                    </section>
                  )}
                  {j.soap_observation && (
                    <section className="rounded-xl border p-3">
                      <div className="text-xs font-semibold mb-1">
                        Observation <span className="opacity-60">(I Believe)</span>
                      </div>
                      <div className="text-sm whitespace-pre-wrap">{j.soap_observation}</div>
                    </section>
                  )}
                  {j.soap_application && (
                    <section className="rounded-xl border p-3">
                      <div className="text-xs font-semibold mb-1">
                        Application <span className="opacity-60">(I Will)</span>
                      </div>
                      <div className="text-sm whitespace-pre-wrap">{j.soap_application}</div>
                    </section>
                  )}
                  {j.soap_prayer && (
                    <section className="rounded-xl border p-3">
                      <div className="text-xs font-semibold mb-1">Prayer</div>
                      <div className="text-sm whitespace-pre-wrap">{j.soap_prayer}</div>
                    </section>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
