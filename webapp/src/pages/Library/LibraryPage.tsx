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

function SectionHeader({ title, onRefresh }: { title: string; onRefresh?: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold">{title}</h2>
      {onRefresh && (
        <button className="text-sm underline" onClick={onRefresh}>
          Refresh
        </button>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-4 bg-white text-sm opacity-80">
      {children}
    </div>
  );
}

export default function LibraryPage() {
  // current user (for realtime filters)
  const [uid, setUid] = React.useState<string | null>(null);
  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

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

  const goto = (hash: string) => {
    window.location.hash = hash;
  };

  // ────────────────────────── Realtime: stars & highlights (filtered by current user) ──────────────────────────
  React.useEffect(() => {
    if (!uid) return;

    const ch = supabase
      .channel('library-stars-highlights')
      // starred verses (only my rows)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'verse_bookmarks', filter: `user_id=eq.${uid}` },
        () => {
          loadStars();
        }
      )
      // devotion highlights (only my rows)
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

  // ────────────────────────── Realtime: collection items ──────────────────────────
  // We subscribe per-collection (since the table has no user_id to filter by).
  React.useEffect(() => {
    if (collections.length === 0) return;

    const ch = supabase.channel('library-collections');

    for (const c of collections) {
      ch.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_collection_items',
          filter: `collection_id=eq.${c.collection_id}`,
        },
        () => {
          // refresh list counts & (if open) the items for the active collection
          loadCollections();
          if (openColId === c.collection_id) loadCollectionItems(c.collection_id);
        }
      );
    }

    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // rewire if the set of collections or the open id changes
  }, [collections.map((c) => c.collection_id).join(','), openColId]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Collections */}
      <div className="rounded-2xl border p-4 bg-white shadow-sm">
        <SectionHeader title="My Collections" onRefresh={loadCollections} />
        {colLoading && <div className="text-sm opacity-70 mt-2">Loading…</div>}
        {colErr && <div className="text-sm text-red-600 mt-2">{colErr}</div>}
        {!colLoading && !colErr && collections.length === 0 && (
          <Empty>You don’t have any collections yet.</Empty>
        )}

        <ul className="mt-3 space-y-3">
          {collections.map((c) => {
            const isOpen = openColId === c.collection_id;
            const items = colItems[c.collection_id] || [];
            return (
              <li key={c.collection_id} className="rounded-xl border p-3 bg-gray-50">
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
                  <div className="mt-3 rounded-lg border bg-white">
                    {items.length === 0 ? (
                      <div className="text-sm opacity-70 p-3">No items yet.</div>
                    ) : (
                      <ul className="divide-y">
                        {items.map((it) => (
                          <li key={it.item_id} className="p-3 flex items-center justify-between gap-3">
                            <div className="text-sm">
                              <div className="font-medium">{it.reference}</div>
                              <div className="text-xs opacity-70 line-clamp-2">
                                {it.verse_text ?? '—'}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                className="text-sm underline"
                                onClick={() => goto(buildVerseHref(it.group_id, it.verse_id))}
                              >
                                Open
                              </button>
                              <button
                                className="text-sm underline text-red-600 disabled:opacity-50"
                                disabled={busyItem === it.item_id}
                                onClick={async () => {
                                  if (!confirm('Remove from this collection?')) return;
                                  setBusyItem(it.item_id);
                                  try {
                                    await removeCollectionItem(it.item_id);
                                    // local state update; realtime will also refresh counts
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
      </div>

      {/* Starred Verses */}
      <div className="rounded-2xl border p-4 bg-white shadow-sm">
        <SectionHeader title="Starred Verses" onRefresh={loadStars} />
        {starLoading && <div className="text-sm opacity-70 mt-2">Loading…</div>}
        {starErr && <div className="text-sm text-red-600 mt-2">{starErr}</div>}
        {!starLoading && !starErr && stars.length === 0 && (
          <Empty>No starred verses yet. Tap the ⭐ on any verse card to save it.</Empty>
        )}

        <ul className="mt-3 divide-y">
          {stars.map((s) => (
            <li key={s.verse_id} className="py-3 flex items-center justify-between gap-3">
              <div className="text-sm">
                <div className="font-medium">{s.reference}</div>
                <div className="text-xs opacity-70 line-clamp-2">{s.verse_text ?? '—'}</div>
                <div className="text-[11px] opacity-60 mt-1">
                  Starred {new Date(s.starred_at).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="text-sm underline" onClick={() => goto(buildVerseHref(s.group_id, s.verse_id))}>
                  Open
                </button>
                <button
                  className="text-sm underline text-red-600"
                  onClick={async () => {
                    if (!confirm('Remove star from this verse?')) return;
                    try {
                      await unstarVerse(s.verse_id);
                      // realtime will refresh, but keep UI snappy
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
      </div>

      {/* My Devotion Highlights */}
      <div className="rounded-2xl border p-4 bg-white shadow-sm">
        <SectionHeader title="My Devotion Highlights" onRefresh={loadHighlights} />
        {hlLoading && <div className="text-sm opacity-70 mt-2">Loading…</div>}
        {hlErr && <div className="text-sm text-red-600 mt-2">{hlErr}</div>}
        {!hlLoading && !hlErr && highlights.length === 0 && (
          <Empty>Your highlights will appear here as you add them.</Empty>
        )}

        <ul className="mt-3 divide-y">
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
                <div className="text-[11px] opacity-60 mt-1">
                  {new Date(h.created_at).toLocaleString()}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Coming soon */}
      <div className="rounded-2xl border p-4 bg-white shadow-sm">
        <h2 className="text-base font-semibold">Coming soon</h2>
        <ul className="mt-2 list-disc ml-5 text-sm opacity-80">
          <li>Journal highlights & Study notes (jump-to-source)</li>
          <li>Search across your Library</li>
          <li>Share a collection with your group or leader</li>
        </ul>
      </div>
    </div>
  );
}
