import React from 'react';
import {
  listMyCollections,
  listMyCollectionVerses,
  listMyStarredVerses,
  listMyDevHighlights,
  removeCollectionItem,
  unstarVerse,
  buildVerseHref,
  buildDevotionHref,
  type MyCollection,
  type MyCollectionVerse,
  type MyStarredVerse,
  type MyDevHighlight,
} from '../../services/library';
import { supabase } from '../../lib/supabaseClient';

/* ---------------- Reusable UI bits (summary style) ---------------- */

function StatChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2.5 py-0.5 text-xs text-[hsl(var(--muted-foreground))]">
      {label}
    </span>
  );
}

function SummaryCard({
  title,
  count,
  loading,
  error,
  onRefresh,
  expanded,
  onToggle,
  preview,
  children,
}: {
  title: string;
  count: number;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  expanded: boolean;
  onToggle: () => void;
  preview?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] p-4 bg-transparent shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <StatChip label={`${count} item${count === 1 ? '' : 's'}`} />
          {loading && <span className="text-xs text-[hsl(var(--muted-foreground))]">Loading…</span>}
          {error && <span className="text-xs text-[hsl(var(--primary))]">{error}</span>}
        </div>
        <div className="flex items-center gap-3">
          {onRefresh && (
            <button
              className="text-sm underline text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              onClick={onRefresh}
            >
              Refresh
            </button>
          )}
          <button className="text-sm underline" onClick={onToggle}>
            {expanded ? 'Hide' : 'Show all'}
          </button>
        </div>
      </div>

      {/* Preview row (chips / snippets) */}
      {!expanded && preview && <div className="mt-3">{preview}</div>}

      {/* Expanded content */}
      {expanded && <div className="mt-3">{children}</div>}
    </div>
  );
}

/* ---------------- Page logic ---------------- */

export default function LibraryPageF180() {
  // current user (for realtime filters)
  const [uid, setUid] = React.useState<string | null>(null);
  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  // Expand/collapse per section
  const [expanded, setExpanded] = React.useState<{
    collections: boolean;
    stars: boolean;
    highlights: boolean;
  }>({ collections: false, stars: false, highlights: false });

  const toggle = (key: keyof typeof expanded) =>
    setExpanded((p) => ({ ...p, [key]: !p[key] }));

  const goto = (hash: string) => {
    window.location.hash = hash;
  };

  // ───────────── Collections ─────────────
  const [collections, setCollections] = React.useState<MyCollection[]>([]);
  const [colLoading, setColLoading] = React.useState(true);
  const [colErr, setColErr] = React.useState<string | null>(null);
  const [openColId, setOpenColId] = React.useState<string | null>(null);
  const [colItems, setColItems] = React.useState<Record<string, MyCollectionVerse[]>>({});
  const [busyItem, setBusyItem] = React.useState<string | null>(null);

  const loadCollections = async () => {
    setColLoading(true);
    setColErr(null);
    try {
      const rows = await listMyCollections();
      setCollections(rows);
    } catch (e: any) {
      setColErr(e?.message ?? 'Failed to load collections');
    } finally {
      setColLoading(false);
    }
  };

  const loadCollectionItems = async (id: string) => {
    try {
      const rows = await listMyCollectionVerses(id);
      setColItems((m) => ({ ...m, [id]: rows }));
    } catch (e: any) {
      alert(e?.message ?? 'Failed to load collection items');
    }
  };

  // ───────────── Starred Verses ─────────────
  const [stars, setStars] = React.useState<MyStarredVerse[]>([]);
  const [starLoading, setStarLoading] = React.useState(true);
  const [starErr, setStarErr] = React.useState<string | null>(null);

  const loadStars = async () => {
    setStarLoading(true);
    setStarErr(null);
    try {
      const rows = await listMyStarredVerses();
      setStars(rows);
    } catch (e: any) {
      setStarErr(e?.message ?? 'Failed to load starred verses');
    } finally {
      setStarLoading(false);
    }
  };

  // ───────────── Devotion Highlights ─────────────
  const [highlights, setHighlights] = React.useState<MyDevHighlight[]>([]);
  const [hlLoading, setHlLoading] = React.useState(true);
  const [hlErr, setHlErr] = React.useState<string | null>(null);

  const loadHighlights = async () => {
    setHlLoading(true);
    setHlErr(null);
    try {
      const rows = await listMyDevHighlights();
      setHighlights(rows);
    } catch (e: any) {
      setHlErr(e?.message ?? 'Failed to load highlights');
    } finally {
      setHlLoading(false);
    }
  };

  // initial load
  React.useEffect(() => {
    loadCollections();
    loadStars();
    loadHighlights();
  }, []);

  // Realtime: stars & highlights (by current user)
  React.useEffect(() => {
    if (!uid) return;

    const ch = supabase
      .channel('library-stars-highlights')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'verse_bookmarks', filter: `user_id=eq.${uid}` },
        () => {
          loadStars();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'devotion_highlights', filter: `user_id=eq.${uid}` },
        () => {
          loadHighlights();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [uid]);

  // Realtime: collection items (per-collection)
  React.useEffect(() => {
    if (collections.length === 0) return;

    const ch = supabase.channel('library-collections');

    for (const c of collections) {
      ch.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_collection_items', filter: `collection_id=eq.${c.collection_id}` },
        () => {
          loadCollections();
          if (openColId === c.collection_id) loadCollectionItems(c.collection_id);
        }
      );
    }

    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collections.map((c) => c.collection_id).join(','), openColId]);

  /* ---------------- Previews (chips/snippets) ---------------- */

  const collectionsPreview = (
    <div className="flex flex-wrap gap-2">
      {collections.slice(0, 3).map((c) => (
        <StatChip key={c.collection_id} label={`${c.name} • ${c.item_count}`} />
      ))}
      {collections.length === 0 && (
        <span className="text-sm text-[hsl(var(--muted-foreground))]">You don’t have any collections yet.</span>
      )}
    </div>
  );

  const starsPreview = (
    <div className="space-y-1">
      {stars.slice(0, 2).map((s) => (
        <div key={s.verse_id} className="text-sm">
          <span className="font-medium">{s.reference}</span>
          <span className="text-[hsl(var(--muted-foreground))]"> — {s.verse_text?.slice(0, 80) ?? '—'}</span>
        </div>
      ))}
      {stars.length === 0 && <span className="text-sm text-[hsl(var(--muted-foreground))]">No starred verses yet.</span>}
    </div>
  );

  const highlightsPreview = (
    <div className="space-y-1">
      {highlights.slice(0, 2).map((h) => (
        <div key={h.highlight_id} className="text-sm">
          <span className="font-medium">
            {h.series_title} • Day {h.day_index}
            {h.entry_title ? ` — ${h.entry_title}` : ''}
          </span>
          <span className="text-[hsl(var(--muted-foreground))]">
            {' '}
            — “{h.selected_text.length > 80 ? h.selected_text.slice(0, 80) + '…' : h.selected_text}”
          </span>
        </div>
      ))}
      {highlights.length === 0 && (
        <span className="text-sm text-[hsl(var(--muted-foreground))]">Your highlights will appear here.</span>
      )}
    </div>
  );

  /* ---------------- Render ---------------- */

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* My Collections — summary + expand */}
      <SummaryCard
        title="My Collections"
        count={collections.length}
        loading={colLoading}
        error={colErr}
        onRefresh={loadCollections}
        expanded={expanded.collections}
        onToggle={() => toggle('collections')}
        preview={collectionsPreview}
      >
        {/* Expanded content: list of collections with optional per-collection expand */}
        <ul className="space-y-3">
          {collections.map((c) => {
            const isOpen = openColId === c.collection_id;
            const items = colItems[c.collection_id] || [];
            return (
              <li key={c.collection_id} className="rounded-xl border border-[hsl(var(--border))] p-3 bg-transparent">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-xs opacity-70">
                      {c.item_count} item{c.item_count === 1 ? '' : 's'} •{' '}
                      {new Date(c.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    className="text-sm underline"
                    onClick={async () => {
                      if (isOpen) {
                        setOpenColId(null);
                      } else {
                        setOpenColId(c.collection_id);
                        if (!colItems[c.collection_id]) {
                          await loadCollectionItems(c.collection_id);
                        }
                      }
                    }}
                  >
                    {isOpen ? 'Hide' : 'Open'}
                  </button>
                </div>

                {isOpen && (
                  <div className="mt-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                    {items.length === 0 ? (
                      <div className="text-sm opacity-70 p-3">No items yet.</div>
                    ) : (
                      <ul className="divide-y divide-[hsl(var(--border))]">
                        {items.map((it) => (
                          <li key={it.item_id} className="p-3 flex items-center justify-between gap-3">
                            <div className="text-sm">
                              <div className="font-medium">{it.reference}</div>
                              <div className="text-xs opacity-70 line-clamp-2">{it.verse_text ?? '—'}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                className="text-sm underline"
                                onClick={() => goto(buildVerseHref(it.group_id, it.verse_id))}
                              >
                                Open
                              </button>
                              <button
                                className="text-sm underline text-[hsl(var(--primary))] disabled:opacity-50"
                                disabled={busyItem === it.item_id}
                                onClick={async () => {
                                  if (!confirm('Remove from this collection?')) return;
                                  setBusyItem(it.item_id);
                                  try {
                                    await removeCollectionItem(it.item_id);
                                    setColItems((m) => ({
                                      ...m,
                                      [c.collection_id]: (m[c.collection_id] || []).filter((x) => x.item_id !== it.item_id),
                                    }));
                                  } catch (e: any) {
                                    alert(e?.message ?? 'Failed to remove');
                                  } finally {
                                    setBusyItem(null);
                                  }
                                }}
                              >
                                {busyItem === it.item_id ? 'Removing…' : 'Remove'}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </SummaryCard>

      {/* Starred Verses — summary + expand */}
      <SummaryCard
        title="Starred Verses"
        count={stars.length}
        loading={starLoading}
        error={starErr}
        onRefresh={loadStars}
        expanded={expanded.stars}
        onToggle={() => toggle('stars')}
        preview={starsPreview}
      >
        <ul className="divide-y divide-[hsl(var(--border))]">
          {stars.map((s) => (
            <li key={s.verse_id} className="py-3 flex items-center justify-between gap-3">
              <div className="text-sm">
                <div className="font-medium">{s.reference}</div>
                <div className="text-xs opacity-70 line-clamp-2">{s.verse_text ?? '—'}</div>
                <div className="text-[11px] opacity-60 mt-1">Starred {new Date(s.starred_at).toLocaleDateString()}</div>
              </div>
              <div className="flex items-center gap-2">
                <button className="text-sm underline" onClick={() => goto(buildVerseHref(s.group_id, s.verse_id))}>
                  Open
                </button>
                <button
                  className="text-sm underline text-[hsl(var(--primary))]"
                  onClick={async () => {
                    if (!confirm('Remove star from this verse?')) return;
                    try {
                      await unstarVerse(s.verse_id);
                      setStars((arr) => arr.filter((x) => x.verse_id !== s.verse_id));
                    } catch (e: any) {
                      alert(e?.message ?? 'Failed to unstar');
                    }
                  }}
                >
                  Unstar
                </button>
              </div>
            </li>
          ))}
        </ul>
      </SummaryCard>

      {/* My Devotion Highlights — summary + expand */}
      <SummaryCard
        title="My Devotion Highlights"
        count={highlights.length}
        loading={hlLoading}
        error={hlErr}
        onRefresh={loadHighlights}
        expanded={expanded.highlights}
        onToggle={() => toggle('highlights')}
        preview={highlightsPreview}
      >
        <ul className="divide-y divide-[hsl(var(--border))]">
          {highlights.map((h) => (
            <li key={h.highlight_id} className="py-3">
              <div className="text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">
                    {h.series_title} • Day {h.day_index}
                    {h.entry_title ? ` — ${h.entry_title}` : ''}
                  </div>
                  <button
                    className="text-sm underline"
                    onClick={() => goto(buildDevotionHref(h.group_id, h.series_id, h.entry_id))}
                  >
                    Open
                  </button>
                </div>
                <div className="opacity-80 mt-1">
                  “{h.selected_text.length > 200 ? h.selected_text.slice(0, 200) + '…' : h.selected_text}”
                </div>
                <div className="text-[11px] opacity-60 mt-1">{new Date(h.created_at).toLocaleString()}</div>
              </div>
            </li>
          ))}
        </ul>
      </SummaryCard>

      {/* Coming soon — non-expandable summary */}
      <div className="rounded-2xl border border-[hsl(var(--border))] p-4 bg-transparent shadow-sm">
        <h2 className="text-base font-semibold tracking-tight">Coming soon</h2>
        <ul className="mt-2 list-disc ml-5 text-sm opacity-80">
          <li>Journal highlights & Study notes (jump-to-source)</li>
          <li>Search across your Library</li>
          <li>Share a collection with your group or leader</li>
        </ul>
      </div>
    </div>
  );
}
