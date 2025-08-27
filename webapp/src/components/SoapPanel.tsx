import React from 'react';
import { saveSoapEntry, type JournalVisibility } from '../services/verses';
import { addGroupPrayer, shareIWill } from '../services/engagement';

export default function SoapPanel({
  groupId,
  verseId,
  scriptureRef,
  scriptureText,
  onSaved,
}: {
  groupId: string;
  verseId: string;
  scriptureRef?: string | null;
  scriptureText?: string | null;
  onSaved?: () => void;
}) {
  const [observation, setObservation] = React.useState('');
  const [application, setApplication] = React.useState('');
  const [prayer, setPrayer] = React.useState('');
  const [visibility, setVisibility] = React.useState<JournalVisibility>('private');

  const [sharePrayer, setSharePrayer] = React.useState(false);
  const [shareWill, setShareWill] = React.useState(false);

  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const reset = () => {
    setObservation('');
    setApplication('');
    setPrayer('');
    setSharePrayer(false);
    setShareWill(false);
  };

  const onSave = async () => {
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      // Save journal
      await saveSoapEntry(
        groupId,
        verseId,
        visibility,
        observation.trim(),
        application.trim(),
        prayer.trim()
      );

      const extras: string[] = [];

      // Optional: push prayer to group list
      if (sharePrayer && prayer.trim()) {
        await addGroupPrayer(groupId, verseId, prayer.trim());
        extras.push('shared prayer with group');
      }

      // Optional: share “I Will” privately with leaders
      if (shareWill && application.trim()) {
        await shareIWill(groupId, verseId, application.trim());
        extras.push('shared “I Will” with leaders');
      }

      setMsg(`Saved to journal${extras.length ? ' and ' + extras.join(' and ') : ''}.`);
      reset();
      onSaved?.();
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border p-4 bg-white/70">
      <div className="text-sm font-semibold mb-2">SOAP Note</div>

      {/* Scripture (auto) */}
      {(scriptureRef || scriptureText) && (
        <div className="mb-3 rounded-lg bg-gray-50 border p-3">
          <div className="text-xs opacity-70 font-medium mb-1">Scripture</div>
          {scriptureRef && <div className="text-xs opacity-70">{scriptureRef}</div>}
          {scriptureText && <div className="text-sm leading-relaxed">{scriptureText}</div>}
        </div>
      )}

      {/* Observation (I Believe) */}
      <div className="mb-3">
        <label className="text-sm font-medium">Observation (I Believe)</label>
        <textarea
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          rows={3}
          placeholder="What does this reveal about God's character? What is true here?"
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
        />
      </div>

      {/* Application (I Will) */}
      <div className="mb-3">
        <label className="text-sm font-medium">Application (I Will)</label>
        <textarea
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          rows={3}
          placeholder="One concrete step I will take this week…"
          value={application}
          onChange={(e) => setApplication(e.target.value)}
        />
      </div>

      {/* Prayer */}
      <div className="mb-3">
        <label className="text-sm font-medium">Prayer</label>
        <textarea
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          rows={3}
          placeholder="Pray the verse back to God in your own words…"
          value={prayer}
          onChange={(e) => setPrayer(e.target.value)}
        />
      </div>

      {/* Visibility + Tie-ins */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm opacity-70">Visibility</label>
          <select
            className="rounded-xl border px-3 py-2 text-sm"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as JournalVisibility)}
          >
            <option value="private">Private</option>
            <option value="group">Group-visible</option>
          </select>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sharePrayer}
              onChange={(e) => setSharePrayer(e.target.checked)}
              disabled={!prayer.trim()}
              title={!prayer.trim() ? 'Enter a prayer first' : ''}
            />
            Pray this with my group
          </label>

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={shareWill}
              onChange={(e) => setShareWill(e.target.checked)}
              disabled={!application.trim()}
              title={!application.trim() ? 'Enter an “I Will” first' : ''}
            />
            Share “I Will” with leaders
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-xl border px-3 py-2 text-sm hover:shadow-sm disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save to Journal'}
        </button>
        {msg && <div className="text-sm text-green-700">{msg}</div>}
        {err && <div className="text-sm text-red-600">{err}</div>}
      </div>
    </div>
  );
}
