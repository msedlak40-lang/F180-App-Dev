import React from 'react';
import { generateWeeklySeries, type StudyGenVisibility } from '../services/study';

type Props = {
  groupId: string;
};

export default function GenerateStudyModal({ groupId }: Props) {
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [weeks, setWeeks] = React.useState(6);
  const [visibility, setVisibility] = React.useState<StudyGenVisibility>('group');
  const [useAI, setUseAI] = React.useState(true); // set false to dry-run (no OpenAI)
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const seriesId = await generateWeeklySeries(groupId, title.trim(), {
        notes: notes.trim() || undefined,
        weeks: Math.max(1, Math.min(12, Number(weeks) || 6)),
        visibility,
        useAI,
      });
      // Navigate to the new series
      window.location.hash = `#/group/${groupId}/study?series=${seriesId}`;
      setOpen(false);
      // reset
      setTitle('');
      setNotes('');
      setWeeks(6);
      setVisibility('group');
      setUseAI(true);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to generate study');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Trigger button */}
      <button
        className="text-sm rounded-lg border px-3 py-1.5"
        onClick={() => setOpen(true)}
        disabled={!groupId}
        title={groupId ? '' : 'Pick a group first'}
      >
        Generate weekly series
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !saving && setOpen(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border bg-white p-4 shadow-xl">
            <div className="text-sm font-semibold mb-2">Generate weekly study</div>
            <form onSubmit={onSubmit} className="grid gap-3">
              {error && <div className="text-sm text-red-600">{error}</div>}

              <div>
                <label className="text-sm font-medium">Title *</label>
                <input
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder='e.g., "Identity in Christ"'
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium">Notes (optional)</label>
                <textarea
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Constraints, passages to emphasize, audience notes…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3">
                <div>
                  <label className="text-sm font-medium">Weeks</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    className="mt-1 w-20 border rounded-lg px-2 py-1.5 text-sm"
                    value={weeks}
                    onChange={(e) => setWeeks(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
                  />
                </div>

                <div className="grid gap-1">
                  <div className="text-sm font-medium">Visibility</div>
                  <div className="flex items-center gap-3 text-sm">
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        name="vis"
                        checked={visibility === 'group'}
                        onChange={() => setVisibility('group')}
                      />
                      Group
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        name="vis"
                        checked={visibility === 'leader'}
                        onChange={() => setVisibility('leader')}
                      />
                      Leader only
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        name="vis"
                        checked={visibility === 'private'}
                        onChange={() => setVisibility('private')}
                      />
                      Private
                    </label>
                  </div>
                </div>

                <label className="ml-auto flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={useAI}
                    onChange={(e) => setUseAI(e.target.checked)}
                  />
                  Use AI (uncheck = dry run)
                </label>
              </div>

              <div className="flex items-center gap-2 justify-end mt-2">
                <button
                  type="button"
                  className="text-sm underline"
                  onClick={() => !saving && setOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="text-sm rounded-lg border px-3 py-1.5 disabled:opacity-50"
                  disabled={saving || !title.trim()}
                >
                  {saving ? 'Generating…' : 'Generate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
