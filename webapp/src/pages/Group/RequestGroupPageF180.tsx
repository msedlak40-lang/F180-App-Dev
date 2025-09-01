import React from "react";
import { requestGroup } from "../../services/groups";

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const TZ_CHOICES = [
  "America/Chicago",
  "America/New_York",
  "America/Denver",
  "America/Los_Angeles",
  "UTC",
];

type Payload = {
  name: string;
  location?: string | null;
  day?: string | null;
  time?: string | null;     // "HH:MM"
  tz?: string | null;       // IANA TZ
  notes?: string | null;
};

export default function RequestGroupPageF180() {
  const [name, setName] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [day, setDay] = React.useState<string>("");
  const [time, setTime] = React.useState<string>(""); // "HH:MM"
  const [tz, setTz] = React.useState<string>("America/Chicago");
  const [notes, setNotes] = React.useState("");

  const [submitting, setSubmitting] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [isDemo, setIsDemo] = React.useState(false);

  // enable demo via hash query: /#/request-group-f180?demo=1
  React.useEffect(() => {
    try {
      const hash =
        typeof window !== "undefined" && window.location && typeof window.location.hash === "string"
          ? window.location.hash
          : "";
      const qIndex = hash.indexOf("?");
      const qs = qIndex >= 0 ? hash.slice(qIndex + 1) : "";
      const p = new URLSearchParams(qs);
      const demo = p.get("demo");
      if (demo === "1" || demo === "true") setIsDemo(true);
    } catch { /* ignore */ }
  }, []);

  const disabled = submitting || !name.trim() || (!!time && !/^\d{2}:\d{2}$/.test(time));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setError(null);
    setSubmitting(true);
    try {
      const payload: Payload = {
        name: name.trim(),
        location: location.trim() || null,
        day: day || null,
        time: time || null,
        tz: tz || null,
        notes: notes.trim() || null,
      };

      if (isDemo) {
        await new Promise((r) => setTimeout(r, 600));
        setMsg("✅ Demo: your request would be submitted. (Not saved)");
      } else {
        await requestGroup(payload as any);
        setMsg("✅ Request submitted and pending approval.");
        // Clear inputs (keep tz preference)
        setName("");
        setLocation("");
        setDay("");
        setTime("");
        setNotes("");
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="f180 space-y-5">
      {/* Header */}
      <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 md:p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-lg font-semibold tracking-tight text-[hsl(var(--card-foreground))]">
            Request a Fireside Group
          </div>
          <div className="text-xs text-white/60">
            Your request will be marked <span className="text-white/80 font-medium">Pending</span> for an admin to approve.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))]">
            <input
              type="checkbox"
              checked={isDemo}
              onChange={(e) => setIsDemo(e.target.checked)}
            />
            Demo mode (don’t save)
          </label>
        </div>
      </div>

      {/* Form Card */}
      <form
        onSubmit={onSubmit}
        className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 md:p-5 space-y-4 text-[hsl(var(--card-foreground))]"
      >
        {/* Group name */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/80">Group name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Iron Sharpens Iron (North Campus)"
            className="h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--popover))] px-3 text-sm text-[hsl(var(--popover-foreground))] placeholder:text-white/50"
          />
          <div className="text-[11px] text-white/50">Use something clear and inviting.</div>
        </div>

        {/* Location */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/80">Location</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City, State or address (optional)"
            className="h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--popover))] px-3 text-sm text-[hsl(var(--popover-foreground))] placeholder:text-white/50"
          />
        </div>

        {/* Schedule row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/80">Day</label>
            <select
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--popover))] px-3 text-sm text-[hsl(var(--popover-foreground))]"
            >
              <option value="">—</option>
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/80">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--popover))] px-3 text-sm text-[hsl(var(--popover-foreground))]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/80">Timezone</label>
            <select
              value={tz}
              onChange={(e) => setTz(e.target.value)}
              className="h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--popover))] px-3 text-sm text-[hsl(var(--popover-foreground))]"
            >
              {TZ_CHOICES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/80">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Anything else the approver should know…"
            className="w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--popover))] px-3 py-2 text-sm text-[hsl(var(--popover-foreground))] placeholder:text-white/50"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={disabled}
            className="h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-4 text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-50"
          >
            {submitting ? "Submitting…" : isDemo ? "Try demo submit" : "Submit request"}
          </button>

          {error && <div className="text-sm text-red-300">{error}</div>}
          {msg && <div className="text-sm text-emerald-300">{msg}</div>}
        </div>

        <div className="text-[11px] text-white/50">
          Submitting with Demo mode enabled will not save anything to the database.
        </div>
      </form>
    </div>
  );
}
