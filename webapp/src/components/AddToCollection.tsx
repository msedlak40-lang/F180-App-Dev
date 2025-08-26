import React from 'react';
import {
  listMyCollections,
  createCollection,
  addToCollection,
  type MyCollection,
} from '../services/engagement';

export default function AddToCollection({ verseId }: { verseId: string }) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [collections, setCollections] = React.useState<MyCollection[]>([]);
  const [selected, setSelected] = React.useState<string>('');
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newIcon, setNewIcon] = React.useState('');
  const [msg, setMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        setLoading(true);
        const rows = await listMyCollections();
        setCollections(rows);
        setSelected(rows[0]?.id ?? '');
      } catch (e: any) {
        alert(e?.message ?? 'Failed to load collections');
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const create = async () => {
    if (!newName.trim()) return;
    try {
      setLoading(true);
      const id = await createCollection(newName.trim(), newIcon.trim() || undefined);
      const rows = await listMyCollections();
      setCollections(rows);
      setSelected(id);
      setCreating(false);
      setNewName(''); setNewIcon('');
    } catch (e: any) {
      alert(e?.message ?? 'Failed to create collection');
    } finally {
      setLoading(false);
    }
  };

  const add = async () => {
    if (!selected) return;
    try {
      setLoading(true);
      await addToCollection(selected, verseId);
      setMsg('Added to collection');
      setTimeout(() => setMsg(null), 1500);
    } catch (e: any) {
      alert(e?.message ?? 'Failed to add to collection');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="px-3 py-1 rounded-xl border hover:shadow-sm"
      >
        Add to Collection
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl border bg-white p-3 shadow-md z-20">
          {loading && <div className="text-sm opacity-70">Loading…</div>}

          {!loading && (
            <div className="space-y-3">
              {!creating ? (
                <>
                  <div className="flex items-center gap-2">
                    <select
                      className="flex-1 rounded-xl border px-3 py-2"
                      value={selected}
                      onChange={(e) => setSelected(e.target.value)}
                    >
                      {collections.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.icon ? `${c.icon} ` : ''}{c.name} {c.item_count ? `(${c.item_count})` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={add}
                      className="rounded-xl border px-3 py-2 hover:shadow-sm"
                      disabled={!selected || loading}
                    >
                      Add
                    </button>
                  </div>

                  <button
                    type="button"
                    className="text-sm underline"
                    onClick={() => setCreating(true)}
                  >
                    + New collection
                  </button>
                </>
              ) : (
                <div className="space-y-2">
                  <input
                    className="w-full rounded-xl border px-3 py-2"
                    placeholder="Collection name (e.g., Identity)"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                  <input
                    className="w-full rounded-xl border px-3 py-2"
                    placeholder="Icon (optional, e.g., 🔥, ❤️)"
                    value={newIcon}
                    onChange={(e) => setNewIcon(e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-xl border px-3 py-2 hover:shadow-sm"
                      onClick={create}
                      disabled={!newName.trim() || loading}
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      className="text-sm underline"
                      onClick={() => setCreating(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {msg && <div className="text-sm text-green-700">{msg}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
