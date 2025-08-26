import React from 'react';
import { saveSoapEntry, type JournalVisibility } from '../services/verses';

export default function SoapPanel({
  groupId,
  verseId,
  scriptureRef,
  scriptureText,
  onSaved,
}: {
  groupId: string;
  verseId: string;
  scriptureRef: string;
  scriptureText?: string | null;
  onSaved?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [visibility, setVisibility] = React.useState<JournalVisibility>('private');

  // Fields: Observation (I Believe), Application (I Will), Prayer
  const [observation, setObservation] = React.useState('');
  const [application, setApplication] = React.useState('');
  const [prayer, setPrayer] = React.useState('');

  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const reset = () => {
    setObservation('');
    setApplication('');
    setPrayer('');
    setVisibility('private');
  };

  const onSave = async () => {
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      await saveSoapEntry(groupId, verseId, visibility, observation, application, prayer);
      setMsg('Saved to journal.');
      reset();
      onSaved?.();
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border">
      <button
        className="w-full text-left px-4 py-3 font-medium rounded-t-xl bg-gray-50"
        onClick={() => setOpen((s) => !s)}
        aria-expanded={open}
      >
        SOAP Journal
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 space-y-3">
          <div className="text-sm opacity-70">
            <div className="font-medium">Scripture</div>
            <div className="mt-1">
              <span className="font-mono">{scriptureRef}</span>
              {scriptureText ? <div className="mt-1">{scriptureText}</div> : null}
            </div>
          </div>

          <div className="grid gap-3">
            <label className="text-sm">
              <span className="block font-medium">Observation (I Believe)</span>
              <textarea
                className="w-full rounded-xl border px-3 py-2"
                rows={3}
                placeholder="What is true here? What is God revealing?"
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
              />
            </label>

            <label className="text-sm">
              <span className="block font-medium">Application (I Will)</span>
              <textarea
                className="w-full rounded-xl border px-3 py-2"
                rows={3}
                placeholder="How will I live this today? (be specific)"
                value={application}
                onChange={(e) => setApplication(e.target.value)}
              />
            </label>

            <label className="text-sm">
              <span className="block font-medium">Prayer</span>
              <textarea
                className="w-full rounded-xl border px-3 py-2"
                rows={3}
                placeholder="Talk to God about this verse."
                value={prayer}
                onChange={(e) => setPrayer(e.target.value)}
              />
            </label>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`vis-${verseId}`}
                    value="private"
                    checked={visibility === 'private'}
                    onChange={() => setVisibility('private')}
                  />
                  Private
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`vis-${verseId}`}
                    value="group"
                    checked={visibility === 'group'}
                    onChange={() => setVisibility('group')}
                  />
                  Group-visible
                </label>
              </div>

              <button
                onClick={onSave}
                disabled={saving || (!observation.trim() && !application.trim() && !prayer.trim())}
                className="px-3 py-2 rounded-xl border hover:shadow-sm disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save to Journal'}
              </button>
            </div>

            {msg && <div className="text-sm text-green-700">{msg}</div>}
            {err && <div className="text-sm text-red-600">{err}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
