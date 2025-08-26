import React from 'react';
import { addMyTag, removeMyTag } from '../services/engagement';

export default function PersonalTags({
  verseId,
  tags,
  onChange,
}: {
  verseId: string;
  tags: string[];
  onChange: (next: string[]) => void;
}) {
  const [val, setVal] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const maxed = tags.length >= 2;

  const tryAdd = async () => {
    const t = val.trim();
    if (!t || busy || maxed) return;
    setBusy(true);
    try {
      await addMyTag(verseId, t);
      onChange([...tags, t]);
      setVal('');
    } catch (e: any) {
      alert(e?.message ?? 'Could not add tag');
    } finally {
      setBusy(false);
    }
  };

  const del = async (t: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await removeMyTag(verseId, t);
      onChange(tags.filter(x => x.toLowerCase() !== t.toLowerCase()));
    } catch (e: any) {
      alert(e?.message ?? 'Could not remove tag');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((t, i) => (
          <span key={i} className="inline-flex items-center gap-2 text-xs px-2 py-0.5 rounded-full bg-gray-100 border">
            {t}
            <button
              type="button"
              className="opacity-60 hover:opacity-100"
              onClick={() => del(t)}
              aria-label={`Remove tag ${t}`}
              title="Remove"
            >
              ×
            </button>
          </span>
        ))}
        {tags.length === 0 && (
          <span className="text-xs opacity-70">No personal tags yet.</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          className="rounded-xl border px-3 py-2 text-sm"
          placeholder={maxed ? 'Max 2 tags reached' : 'Add a tag (2 max)'}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); tryAdd(); } }}
          disabled={busy || maxed}
        />
        <button
          type="button"
          onClick={tryAdd}
          disabled={busy || maxed || !val.trim()}
          className="rounded-xl border px-3 py-2 text-sm hover:shadow-sm disabled:opacity-60"
        >
          Add
        </button>
      </div>
    </div>
  );
}
