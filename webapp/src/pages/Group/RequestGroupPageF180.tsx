import React from "react";
import { supabase } from "../../lib/supabaseClient";

type FormState = {
  name: string;
  location: string;            // short label (e.g., "Members House")
  metting_location: string;    // (sic) full address column name in your DB
  meeting_day: string;         // e.g., "Wednesday"
  meeting_time: string;        // "HH:MM"
  meeting_timezone: string;    // IANA tz
  notes: string;
};

const DAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

const TIMEZONES = [
  "America/Chicago",
  "America/New_York",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "UTC",
];

export default function RequestGroupPageF180() {
  const [state, setState] = React.useState<FormState>({
    name: "",
    location: "",
    metting_location: "",
    meeting_day: "",
    meeting_time: "",
    meeting_timezone: "America/Chicago",
    notes: "",
  });

  // NEW: requester contact email (required for notifications)
  const [email, setEmail] = React.useState<string>("");

  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  // NEW: prefill email from current session if available
  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uEmail = data?.user?.email ?? "";
      setEmail((prev) => prev || uEmail);
    });
  }, []);

  function onChange<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function validate(): string | null {
    if (!state.name.trim()) return "Please enter a group name.";
    if (!email.trim()) return "Please enter a contact email.";
    if (!email.includes("@")) return "Please enter a valid email.";
    if (!state.meeting_day) return "Please choose a meeting day.";
    if (!state.meeting_time) return "Please choose a meeting time.";
    if (!state.meeting_timezone) return "Please choose a time zone.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);

    const v = validate();
    if (v) {
      setErr(v);
      return;
    }

    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user_id = auth.user?.id ?? null;

      // Normalize your form state into a single payload object
      const payload = {
        requester_id: user_id,
        owner_id: user_id,
        email: email.trim() || null,                     // <-- NEW
        name: state.name.trim(),
        location: state.location.trim() || null,         // short label
        metting_location: state.metting_location.trim() || null, // full address (sic)
        meeting_day: state.meeting_day,
        meeting_time: state.meeting_time,
        meeting_timezone: state.meeting_timezone,
        notes: state.notes.trim() || null,
        created_at: new Date().toISOString(),
        status: "pending",
      };

      // 1) RPC (jsonb) — matches: public.request_group(payload jsonb)
      const { data: rpcId1, error: rpcErr1 } = await supabase.rpc("request_group", { payload });
      if (!rpcErr1 && rpcId1) {
        setMsg("Request sent. An admin will review and approve.");
        resetForm();
        return;
      }
      if (rpcErr1) console.error("RPC jsonb error:", rpcErr1);

      // 2) RPC (scalars) — optional overload if you have it
      const { data: rpcId2, error: rpcErr2 } = await supabase.rpc("request_group", {
        email: payload.email,
        name: payload.name,
        location: payload.location,
        note: payload.notes,
      });
      if (!rpcErr2 && rpcId2) {
        setMsg("Request sent. An admin will review and approve.");
        resetForm();
        return;
      }
      if (rpcErr2) console.error("RPC scalar error:", rpcErr2);

      // 3) Direct insert into group_requests (fallback)
      const insertRow = {
        created_by: user_id,
        email: payload.email,                 // <-- NEW
        name: payload.name,
        location: payload.location,
        note: payload.notes,                  // table column is singular "note"
        payload,                              // store full JSON for admins
        status: "pending",
      };

      const { data: ins, error: insErr } = await supabase
        .from("group_requests")
        .insert(insertRow)
        .select("id")
        .single();

      if (!insErr && ins) {
        setMsg("Request sent. An admin will review and approve.");
        resetForm();
        return;
      }
      if (insErr) console.error("Insert group_requests error:", insErr);

      // If all 3 attempts failed, show a helpful message
      throw new Error(
        "Could not submit request. Please verify the intake RPC/table name (expected one of: rpc: request_group; table: group_requests or groups_pending)."
      );
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong while sending your request.");
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    setState({
      name: "",
      location: "",
      metting_location: "",
      meeting_day: "",
      meeting_time: "",
      meeting_timezone: "America/Chicago",
      notes: "",
    });
    setEmail("");
  }

  return (
    <div className="f180">
      {/* Scoped dark theme for native controls (select/date/time) */}
      <style>{`
        .f180 select,
        .f180 input[type="time"],
        .f180 input[type="date"],
        .f180 input[type="datetime-local"] {
          background-color: hsl(var(--popover));
          color: hsl(var(--popover-foreground));
          border: 1px solid hsl(var(--input));
          color-scheme: dark;
        }
        .f180 input[type="time"]::-webkit-calendar-picker-indicator,
        .f180 input[type="date"]::-webkit-calendar-picker-indicator,
        .f180 input[type="datetime-local"]::-webkit-calendar-picker-indicator {
          filter: invert(1) opacity(0.92);
        }
        .f180 select:focus,
        .f180 input[type="time"]:focus,
        .f180 input[type="date"]:focus,
        .f180 input[type="datetime-local"]:focus {
          outline: none;
          box-shadow: 0 0 0 2px hsl(var(--ring));
        }
      `}</style>

      <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 md:p-5">
        <div className="text-lg font-semibold tracking-tight text-[hsl(var(--card-foreground))]">
          Request a New Fireside Group
        </div>
        <p className="mt-1 text-sm text-white/70">
          Submit your group details. An admin will review and approve.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Group name */}
          <div>
            <label className="block text-xs text-white/70 mb-1">Group name</label>
            <input
              type="text"
              value={state.name}
              onChange={(e) => onChange("name", e.target.value)}
              className="h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--popover))] text-[hsl(var(--popover-foreground))] px-3 text-sm focus:outline-none"
              placeholder="e.g., North Austin Fireside"
              required
            />
          </div>

          {/* NEW: Contact Email */}
          <div className="space-y-1">
            <label className="block text-xs text-white/70 mb-1">Contact Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--popover))] text-[hsl(var(--popover-foreground))] px-3 text-sm focus:outline-none"
              placeholder="you@example.com"
              required
            />
            <p className="text-xs text-white/50">
              We’ll email you when your request is approved.
            </p>
          </div>

          {/* Location label + Address */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/70 mb-1">
                Location label (short)
              </label>
              <input
                type="text"
                value={state.location}
                onChange={(e) => onChange("location", e.target.value)}
                className="h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--popover))] text-[hsl(var(--popover-foreground))] px-3 text-sm focus:outline-none"
                placeholder='e.g., "Members House"'
              />
            </div>
            <div>
              <label className="block text-xs text-white/70 mb-1">
                Address (stored in <code className="font-mono">metting_location</code>)
              </label>
              <input
                type="text"
                value={state.metting_location}
                onChange={(e) => onChange("metting_location", e.target.value)}
                className="h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--popover))] text-[hsl(var(--popover-foreground))] px-3 text-sm focus:outline-none"
                placeholder="Street, City, State"
              />
            </div>
          </div>

          {/* Day / Time / Time zone */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-white/70 mb-1">Meeting day</label>
              <select
                value={state.meeting_day}
                onChange={(e) => onChange("meeting_day", e.target.value)}
                className="h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--popover))] text-[hsl(var(--popover-foreground))] px-3 text-sm focus:outline-none"
                required
              >
                <option value="">Select day</option>
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-white/70 mb-1">Meeting time</label>
              <input
                type="time"
                value={state.meeting_time}
                onChange={(e) => onChange("meeting_time", e.target.value)}
                className="h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--popover))] text-[hsl(var(--popover-foreground))] px-3 text-sm focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-white/70 mb-1">Time zone</label>
              <select
                value={state.meeting_timezone}
                onChange={(e) => onChange("meeting_timezone", e.target.value)}
                className="h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--popover))] text-[hsl(var(--popover-foreground))] px-3 text-sm focus:outline-none"
                required
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-white/70 mb-1">Notes (optional)</label>
            <textarea
              value={state.notes}
              onChange={(e) => onChange("notes", e.target.value)}
              className="min-h-[84px] w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--popover))] p-2 text-sm text-[hsl(var(--popover-foreground))] focus:outline-none"
              placeholder="Anything an admin should know (parking, gate code, etc.)"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="h-9 rounded-lg bg-white/90 text-black px-4 text-sm disabled:opacity-50"
              title="Send for approval"
            >
              {busy ? "Sending…" : "Submit for approval"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              disabled={busy}
              className="h-9 rounded-lg border border-[hsl(var(--border))] bg-transparent px-4 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50"
            >
              Reset
            </button>
          </div>

          {/* Messages */}
          {msg && (
            <div className="mt-3 rounded-[var(--radius)] border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">
              {msg}
            </div>
          )}
          {err && (
            <div className="mt-3 rounded-[var(--radius)] border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              {err}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
