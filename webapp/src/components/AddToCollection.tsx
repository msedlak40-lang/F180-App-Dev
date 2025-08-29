import React from 'react';
import {
  listMyCollections,
  addVerseToCollection,
  type MyCollection,
} from '../services/library';

export default function AddToCollection({ verseId }: { verseId: string }) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [collections, setCollections] = React.useState<MyCollection[]>([]);
  const [err, setErr] = React.useState<string | null>(null);
  const [addingId, setAddingId] = React.useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const rows = await listMyCollections();
      setCollections(rows);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load collections');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (open) load();
  }, [open]);

  return (
    <div className="relative">
      <button
        className="text-sm underline"
        onClick={() => setOpen((s) => !s)}
        title="Add this verse to one of your collections"
      >
        Add to collection…
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-80 rounded-xl border bg-white shadow-lg p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Your Collections</div>
            <button className="text-sm underline" onClick={load}>Refresh</button>
          </div>

          {loading && <div className="text-sm opacity-70 mt-2">Loading…</div>}
          {err && <div className="text-sm text-red-600 mt-2">{err}</div>}

          {!loading && !err && collections.length === 0 && (
            <div className="text-sm opacity-70 mt-2">
              No collections yet. Create one from the Library page.
            </div>
          )}

          {!loading && !err && collections.length > 0 && (
            <ul className="mt-2 divide-y">
              {collections.map((c) => (
                <li key={c.collection_id} className="py-2 flex items-center justify-between gap-2">
                  <div className="text-sm">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-[11px] opacity-60">
                      {c.item_count} item{c.item_count === 1 ? '' : 's'}
                    </div>
                  </div>
                  <button
                    className="text-sm underline disabled:opacity-50"
                    disabled={addingId === c.collection_id}
onClick={async () => {
  setAddingId(c.collection_id);
  try {
    const cid = (c as any).collection_id ?? (c as any).id;  // <— fallback if needed
    if (!cid) throw new Error('No collection id available');
    console.log('AddToCollection: using collection_id', cid);
    await addVerseToCollection(cid, verseId);
    alert(`Added to "${c.name}".`);
    setOpen(false);
  } catch (e: any) {
    alert(e?.message ?? 'Failed to add');
  } finally {
    setAddingId(null);
  }
}}
                  >
                    {addingId === c.collection_id ? 'Adding…' : 'Add'}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2 text-right">
            <button className="text-sm underline" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
