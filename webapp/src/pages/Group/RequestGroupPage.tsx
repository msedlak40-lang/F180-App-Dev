import React from 'react';
import { requestGroup } from '../../services/groups';

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const TZ_CHOICES = ['America/Chicago','America/New_York','America/Denver','America/Los_Angeles','UTC'];

export default function RequestGroupPage() {
  const [name, setName] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [day, setDay] = React.useState<string>('');
  const [time, setTime] = React.useState<string>(''); // "HH:MM"
  const [tz, setTz] = React.useState<string>('America/Chicago');
  const [attending, setAttending] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMsg(null);
    try {
      const gid = await requestGroup({
        name: name.trim(),
        location: location.trim() || undefined,
        meeting_day: day || undefined,
        meeting_time: time || undefined,
        meeting_timezone: tz || undefined,
        attending_hint: attending.trim() || undefined,
      });
      setMsg('Request submitted. A leader/admin will review it soon.');
      setName(''); setLocation(''); setDay(''); setTime(''); setAttending('');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-4 space-y-4">
      <div className="rounded-2xl border p-4 bg-white">
        <div className="text-base font-semibold">Request a Fireside Group</div>
        <p className="text-sm opacity-80 mt-1">
          Tell us the basics. Your request will be marked <strong>pending</strong> for an admin/owner to approve.
        </p>

        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <div>
            <label className="text-sm font-medium">Group name</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Kenny's Olathe F180"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium">Location (city / area)</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Olathe, KS"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium">Day</label>
              <select
                className="w-full border rounded-lg px-2 py-2 text-sm mt-1"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              >
                <option value="">(choose)</option>
                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Time</label>
              <input
                type="time"
                className="w-full border rounded-lg px-2 py-2 text-sm mt-1"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Timezone</label>
              <select
                className="w-full border rounded-lg px-2 py-2 text-sm mt-1"
                value={tz}
                onChange={(e) => setTz(e.target.value)}
              >
                {TZ_CHOICES.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Who’s attending? (optional)</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              rows={3}
              value={attending}
              onChange={(e) => setAttending(e.target.value)}
              placeholder="Names or a short description"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              className="rounded-lg px-3 py-1.5 border bg-gray-50 text-sm disabled:opacity-50"
              disabled={submitting || !name.trim()}
            >
              {submitting ? 'Submitting…' : 'Submit request'}
            </button>
            {error && <div className="text-sm text-red-600">{error}</div>}
            {msg && <div className="text-sm text-green-700">{msg}</div>}
          </div>
        </form>
      </div>
    </div>
  );
}
