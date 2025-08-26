import React from 'react';
import { createGroupVerse, listGroupVerses } from '../../services/verses';
import type { GroupVerse } from '../../services/verses';
import { listMyBookmarksForVerses, listMyTagsForVerses, bookmarkVerse, unbookmarkVerse } from '../../services/engagement';
import VerseCard from '../../components/VerseCard';

const versions = ['ESV', 'NIV', 'NLT', 'NKJV', 'KJV'];

export default function VersesTab({ groupId }: { groupId: string }) {
  const [verses, setVerses] = React.useState<GroupVerse[]>([]);
  const [starredIds, setStarredIds] = React.useState<Set<string>>(new Set());
  const [myTagsMap, setMyTagsMap] = React.useState<Record<string, string[]>>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [reference, setReference] = React.useState('');
  const [version, setVersion] = React.useState('ESV');
  const [notes, setNotes] = React.useState('');

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const rows = await listGroupVerses(groupId);
      setVerses(rows);

      const ids = rows.map(r => r.id);
      const starred = await listMyBookmarksForVerses(ids);
      setStarredIds(new Set(starred));

      const tagMap = await listMyTagsForVerses(ids);
      setMyTagsMap(tagMap);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load verses');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { load(); }, [groupId]);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reference.trim()) return;
    try {
      await createGroupVerse(groupId, reference.trim(), version, notes.trim() || undefined);
      setReference(''); setNotes('');
      await load();
    } catch (e: any) {
      alert(e?.message ?? 'Failed to add verse');
    }
  };

  const handleStarChange = async (verseId: string, next: boolean) => {
    try {
      if (next) {
        await bookmarkVerse(verseId);
        setStarredIds(prev => new Set(prev).add(verseId));
      } else {
        await unbookmarkVerse(verseId);
        setStarredIds(prev => {
          const n = new Set(prev);
          n.delete(verseId);
          return n;
        });
      }
    } catch (e:any) {
      alert(e?.message ?? 'Bookmark toggle failed');
    }
  };

  const handleTagsChange = (verseId: string, next: string[]) => {
    setMyTagsMap(prev => ({ ...prev, [verseId]: next }));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="rounded-2xl border p-4 shadow-sm bg-white">
        <h2 className="text-lg font-semibold">Add a Verse</h2>
        <p className="text-sm opacity-70">
          Enter a reference (e.g., <span className="font-mono">1 John 3:18</span>). We’ll fetch the text and enrich it.
        </p>

        <form onSubmit={onAdd} className="mt-3 grid gap-3 sm:grid-cols-4">
          <input
            className="sm:col-span-2 rounded-xl border px-3 py-2"
            placeholder="Reference (e.g., John 3:16)"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            required
          />
          <select className="rounded-xl border px-3 py-2" value={version} onChange={(e) => setVersion(e.target.value)}>
            {versions.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <button type="submit" className="rounded-xl border px-3 py-2 hover:shadow-sm" disabled={!reference.trim()}>
            Add Verse
          </button>
          <textarea
            className="sm:col-span-4 rounded-xl border px-3 py-2"
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </form>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Group Verses</h2>
          <button onClick={load} className="text-sm underline">Refresh</button>
        </div>

        {loading && <div className="text-sm opacity-70">Loading…</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!loading && !error && verses.length === 0 && (
          <div className="rounded-xl border p-4 bg-white text-sm opacity-80">
            No verses yet. Add one above to get started.
          </div>
        )}

        {verses.map(v => (
          <VerseCard
            key={v.id}
            v={v}
            groupId={groupId}
            starred={starredIds.has(v.id)}
            myTags={myTagsMap[v.id] ?? []}
            onStarChange={handleStarChange}
            onTagsChange={handleTagsChange}
            onRefresh={load}
          />
        ))}
      </div>
    </div>
  );
}
