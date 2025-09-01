import * as React from "react";

type StudyGenVisibility = "group" | "leader" | "private";

type Props = {
  groupId: string;
  onInsert: (draft: { title: string; sections: string[]; visibility: StudyGenVisibility }) => void;
};

export default function GenerateStudyModalF180({ groupId, onInsert }: Props) {
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [weeks, setWeeks] = React.useState(6);
  const [visibility, setVisibility] = React.useState<StudyGenVisibility>("group");
  const [useAI, setUseAI] = React.useState(true); // preview toggle only
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      // PREVIEW: synthesize sections from weeks + notes.
      const count = Math.max(1, Math.min(12, Number(weeks) || 6));
      const base = useAI
        ? "AI outline coming soon (preview): key theme, passage focus, discussion, application, prayer."
        : "Manual outline (dry run).";
      const sections = Array.from({ length: count }, (_, i) => {
        const n = i + 1;
        const noteLine = notes.trim() ? ` Notes: ${notes.trim()}` : "";
        return `Week ${n}: ${base}${noteLine}`;
      });

      onInsert({ title: title.trim(), sections, visibility });

      // reset + close
      setOpen(false);
      setTitle("");
      setNotes("");
      setWeeks(6);
      setVisibility("group");
      setUseAI(true);
    } catch (err: any) {
      setError(err?.message ?? "Failed to generate study");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Trigger button (matches your live vibe, styled to dark UI) */}
      <button
        className="text-sm rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary))]/80"
        onClick={() => setOpen(true)}
        disabled={!groupId}
        title={groupId ? "" : "Pick a group first"}
      >
        Generate weekly series
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => !saving && setOpen(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-xl">
            <div className="text-sm font-semibold mb-2">Generate weekly study</div>
            <form onSubmit={onSubmit} className="grid gap-3">
              {error && <div className="text-sm text-red-400">{error}</div>}

              <div>
                <label className="text-sm font-medium">Title *</label>
                <input
                  className="mt-1 w-full border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm bg-[hsl(var(--secondary))]"
                  placeholder='e.g., "Identity in Christ"'
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium">Notes (optional)</label>
                <textarea
                  className="mt-1 w-full border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm bg-[hsl(var(--secondary))]"
                  rows={3}
                  placeholder="Constraints, passages to emphasize, audience notes…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap items-start gap-3">
                <div>
                  <label className="text-sm font-medium">Weeks</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    className="mt-1 w-20 border border-[hsl(var(--border))] rounded-lg px-2 py-1.5 text-sm bg-[hsl(var(--secondary))]"
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
                        checked={visibility === "group"}
                        onChange={() => setVisibility("group")}
                      />
                      Group
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        name="vis"
                        checked={visibility === "leader"}
                        onChange={() => setVisibility("leader")}
                      />
                      Leader only
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        name="vis"
                        checked={visibility === "private"}
                        onChange={() => setVisibility("private")}
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
                  Use AI (preview)
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
                  className="text-sm rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 bg-[hsl(var(--secondary))] disabled:opacity-50"
                  disabled={saving || !title.trim()}
                >
                  {saving ? "Generating…" : "Generate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
