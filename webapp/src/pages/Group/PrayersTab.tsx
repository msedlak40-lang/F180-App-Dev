import React from 'react';
import {
  createPrayer,
  listGroupPrayers,
  listPrayerComments,
  addPrayerComment,
  updatePrayer,
  deletePrayer,
  type PrayerItem,
  type PrayerVisibility
} from '../../services/prayers';
import { listGroupVerses, type GroupVerse } from '../../services/verses';
import { supabase } from '../../lib/supabaseClient';

function VisibilityBadge({ v }: { v: PrayerVisibility }) {
  const label = v === 'group' ? 'Group' : v === 'leaders' ? 'Leaders' : 'Private';
  const cls =
    v === 'group'   ? 'bg-blue-50' :
    v === 'leaders' ? 'bg-amber-50' :
                      'bg-gray-50';
  return <span className={`px-2 py-0.5 text-xs rounded-full border ${cls}`}>{label}</span>;
}

function Comments({ prayerId }: { prayerId: string }) {
  const [items, setItems] = React.useState<Awaited<ReturnType<typeof listPrayerComments>>>([]);
  const [val, setVal] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const rows = await listPrayerComments(prayerId, 200);
      setItems(rows);
    } catch (e:any) {
      setErr(e?.message ?? 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { load(); }, [prayerId]);

  const send = async () => {
    const t = val.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await addPrayerComment(prayerId, t);
      setVal('');
      await load();
    } catch (e:any) {
      alert(e?.message ?? 'Failed to add comment');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 rounded-xl border bg-white/70">
      <div className="max-h-64 overflow-auto p-3 space-y-2">
        {loading && <div className="text-sm opacity-70">Loading…</div>}
        {err && <div className="text-sm text-red-600">{err}</div>}
        {!loading && !err && items.length === 0 && (
          <div className="text-sm opacity-70">No comments yet.</div>
        )}
        {items.map(c => (
          <div key={c.id} className={`text-sm ${c.is_me ? 'text-right' : 'text-left'}`}>
            <span className={`inline-block px-2 py-1 rounded-lg border ${c.is_me ? 'bg-blue-50' : 'bg-gray-50'}`}>
              {c.body_text}
            </span>
            <div className="text-[11px] opacity-60 mt-0.5">{new Date(c.created_at).toLocaleString()}</div>
          </div>
        ))}
      </div>
      <div className="border-t p-2 flex items-center gap-2">
        <input
          className="flex-1 rounded-xl border px-3 py-2 text-sm"
          placeholder="Write a comment…"
          value={val}
          onChange={(e)=>setVal(e.target.value)}
          onKeyDown={(e)=>{ if (e.key === 'Enter') { e.preventDefault(); send(); } }}
          disabled={busy}
        />
        <button
          className="rounded-xl border px-3 py-2 text-sm hover:shadow-sm disabled:opacity-60"
          onClick={send}
          disabled={busy || !val.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default function PrayersTab({
  groupId,
  active = false,
  onNew,
}: {
  groupId: string;
  active?: boolean;                   // parent tells us if Prayers tab is active
  onNew?: (hasNew: boolean) => void;  // notify parent to show/hide badge
}) {
  const [prayers, setPrayers] = React.useState<PrayerItem[]>([]);
  const [verses, setVerses] = React.useState<GroupVerse[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // new prayer form
  const [text, setText] = React.useState('');
  const [visibility, setVisibility] = React.useState<PrayerVisibility>('group');
  const [linkVerseId, setLinkVerseId] = React.useState<string>('');
  const [busy, setBusy] = React.useState(false);

  // realtime notice + parent badge
  const [hasNew, setHasNew] = React.useState(false);
  const meRef = React.useRef<string | null>(null);

  // edit state
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editText, setEditText] = React.useState('');
  const [editVisibility, setEditVisibility] = React.useState<PrayerVisibility>('group');
  const [editVerseId, setEditVerseId] = React.useState<string>('');
  const [savingEdit, setSavingEdit] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const rows = await listGroupPrayers(groupId);
      setPrayers(rows);
      // prefetch latest verses for linking (top 20)
      const vrows = await listGroupVerses(groupId);
      setVerses(vrows.slice(0, 20));
      setHasNew(false);
      onNew?.(false);
    } catch (e:any) {
      setError(e?.message ?? 'Failed to load prayers');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (!groupId) return;
    load();
    supabase.auth.getUser().then(({ data }) => { meRef.current = data?.user?.id ?? null; });

    const channel = supabase.channel(`prayers:${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'group_prayers',
        filter: `group_id=eq.${groupId}`
      }, (payload) => {
        // RLS will only deliver rows we can see; show notice for others' inserts
        const authorId = (payload.new as any)?.author_id;
        if (authorId && authorId !== meRef.current) {
          setHasNew(true);
          onNew?.(true);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId]);

  // Clear “new” flag when tab becomes active
  React.useEffect(() => {
    if (active) {
      setHasNew(false);
      onNew?.(false);
    }
  }, [active, onNew]);

  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await createPrayer(groupId, text.trim(), visibility, linkVerseId || null);
      setText('');
      setVisibility('group');
      setLinkVerseId('');
      await load();
    } catch (e:any) {
      alert(e?.message ?? 'Failed to create prayer');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (p: PrayerItem) => {
    setEditingId(p.id);
    setEditText(p.prayer_text);
    setEditVisibility(p.visibility);
    setEditVerseId(p.verse_id ?? '');
  };

  const saveEdit = async () => {
    if (!editingId || savingEdit) return;
    setSavingEdit(true);
    try {
      await updatePrayer(editingId, {
        text: editText,
        visibility: editVisibility,
        verseId: editVerseId || null, // null clears link
      });
      setEditingId(null);
      await load();
    } catch (e:any) {
      alert(e?.message ?? 'Failed to update prayer');
    } finally {
      setSavingEdit(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const removePrayer = async (id: string) => {
    if (deletingId) return;
    if (!confirm('Delete this prayer?')) return;
    setDeletingId(id);
    try {
      await deletePrayer(id);
      await load();
    } catch (e:any) {
      alert(e?.message ?? 'Failed to delete prayer');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Create prayer */}
      <div className="rounded-2xl border p-4 bg-white shadow-sm">
        <h2 className="text-lg font-semibold">Create a Prayer</h2>
        <p className="text-sm opacity-70">Post a prayer for this group. You can keep it private, share with leaders, or share with the whole group.</p>

        <textarea
          className="mt-3 w-full rounded-xl border px-3 py-2 text-sm"
          rows={3}
          placeholder="Write your prayer…"
          value={text}
          onChange={(e)=>setText(e.target.value)}
        />

        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <label className="text-sm opacity-70">Visibility</label>
            <select
              className="rounded-xl border px-3 py-2 text-sm"
              value={visibility}
              onChange={(e)=>setVisibility(e.target.value as PrayerVisibility)}
            >
              <option value="group">Group</option>
              <option value="leaders">Leaders only</option>
              <option value="private">Private (only me)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm opacity-70">Link verse</label>
            <select
              className="rounded-xl border px-3 py-2 text-sm"
              value={linkVerseId}
              onChange={(e)=>setLinkVerseId(e.target.value)}
            >
              <option value="">— None —</option>
              {verses.map(v => (
                <option key={v.id} value={v.id}>{v.reference}</option>
              ))}
            </select>
          </div>

          <button
            className="rounded-xl border px-3 py-2 text-sm hover:shadow-sm disabled:opacity-60"
            onClick={submit}
            disabled={busy || !text.trim()}
          >
            {busy ? 'Posting…' : 'Post Prayer'}
          </button>
        </div>
      </div>

      {/* New notice */}
      {hasNew && (
        <div className="rounded-xl border p-3 bg-blue-50 flex items-center justify-between">
          <div className="text-sm">New prayer posted.</div>
          <button className="text-sm underline" onClick={load}>Refresh</button>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Group Prayers</h2>
          <button className="text-sm underline" onClick={load}>Refresh</button>
        </div>

        {loading && <div className="text-sm opacity-70">Loading…</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!loading && !error && prayers.length === 0 && (
          <div className="rounded-2xl border p-4 bg-white text-sm opacity-80">No prayers yet.</div>
        )}

        {prayers.map(p => {
          const isEditing = editingId === p.id;
          return (
            <div key={p.id} className="rounded-2xl border p-4 bg-white shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm opacity-70">{new Date(p.created_at).toLocaleString()}</div>
                  <div className="mt-1 flex items-center gap-2">
                    {p.is_me && <span className="px-2 py-0.5 text-xs rounded-full border bg-gray-50">You</span>}
                    <VisibilityBadge v={p.visibility} />
                    <span className="text-sm opacity-80">{p.reference ?? '—'}</span>
                  </div>
                </div>

                {/* Actions (author only shown; leaders can still use via server permission if we later expose) */}
                {!isEditing && p.is_me && (
                  <div className="flex items-center gap-2">
                    <button className="text-sm underline" onClick={() => startEdit(p)}>Edit</button>
                    <button
                      className="text-sm underline text-red-600 disabled:opacity-50"
                      onClick={() => removePrayer(p.id)}
                      disabled={deletingId === p.id}
                    >
                      {deletingId === p.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                )}
              </div>

              {/* Display vs Edit */}
              {!isEditing ? (
                <>
                  <div className="mt-3 rounded-xl bg-gray-50 border p-3">
                    <div className="text-xs opacity-70 font-medium mb-1">Prayer</div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{p.prayer_text}</p>
                  </div>

                  {/* Comments */}
                  <details className="mt-3">
                    <summary className="text-sm underline cursor-pointer">
                      Comments {p.comments_count ? `(${p.comments_count})` : ''}
                    </summary>
                    <Comments prayerId={p.id} />
                  </details>
                </>
              ) : (
                <div className="mt-3 space-y-2">
                  <textarea
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    rows={3}
                    value={editText}
                    onChange={(e)=>setEditText(e.target.value)}
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <label className="text-sm opacity-70">Visibility</label>
                      <select
                        className="rounded-xl border px-3 py-2 text-sm"
                        value={editVisibility}
                        onChange={(e)=>setEditVisibility(e.target.value as PrayerVisibility)}
                      >
                        <option value="group">Group</option>
                        <option value="leaders">Leaders only</option>
                        <option value="private">Private</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm opacity-70">Link verse</label>
                      <select
                        className="rounded-xl border px-3 py-2 text-sm"
                        value={editVerseId}
                        onChange={(e)=>setEditVerseId(e.target.value)}
                      >
                        <option value="">— None —</option>
                        {verses.map(v => (
                          <option key={v.id} value={v.id}>{v.reference}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="rounded-xl border px-3 py-2 text-sm hover:shadow-sm disabled:opacity-60"
                        onClick={saveEdit}
                        disabled={savingEdit}
                      >
                        {savingEdit ? 'Saving…' : 'Save'}
                      </button>
                      <button className="text-sm underline" onClick={cancelEdit}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
