import React from "react";
import { supabase } from "../../lib/supabaseClient";

type Group = { id: string; name?: string | null };

type Votd = {
  date: string;
  seed: string;
  verse: { ref: string; text: string; testament: "OT" | "NT"; tags?: string[] };
  plain_words?: string;
};

type EventLite = {
  id: string;
  title?: string | null;
  starts_label?: string | null;  // e.g., "Wed, Sep 3, 7:00 PM (America/Chicago)"
  location?: string | null;      // label like "Members House"
  address?: string | null;       // from groups.meeting_location
  day_text?: string | null;      // from groups.meeting_day
};

function CalendarIconRed({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#ef4444"
        d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Zm13 9H4v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8ZM5 7a1 1 0 0 0-1 1v1h16V8a1 1 0 0 0-1-1H5Z"
      />
    </svg>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2 py-0.5 text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">
      {children}
    </span>
  );
}

export default function HomePageF180() {
  const [groups, setGroups] = React.useState<Group[]>([]);
  const [gid, setGid] = React.useState<string | null>(null);
  const [gname, setGname] = React.useState<string | null>(null);
  const [loadingGroups, setLoadingGroups] = React.useState(true);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);

  // VOTD
  const [votd, setVotd] = React.useState<Votd | null>(null);
  const [loadingVotd, setLoadingVotd] = React.useState(false);
  const [votdError, setVotdError] = React.useState<string | null>(null);
  const [votdStarred, setVotdStarred] = React.useState<boolean>(false);

  // Next Fireside (from groups)
  const [nextEvent, setNextEvent] = React.useState<EventLite | null>(null);
  const [loadingEvent, setLoadingEvent] = React.useState(false);

  // Nudge / Streak
  const [nudge, setNudge] = React.useState<string>("");
  const [nudgeDone, setNudgeDone] = React.useState(false);
  const [streak, setStreak] = React.useState<number>(0);

  // Messages
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        setCurrentUserId(data.user?.id ?? null);
      } catch {
        setCurrentUserId(null);
      }
    })();
  }, []);

  React.useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("f180.currentGroupId") : null;
    if (saved) setGid(saved);
    loadMyGroups(saved ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!gid) {
      setVotd(null); setVotdError(null);
      setNextEvent(null);
      setNudge(""); setStreak(0); setVotdStarred(false);
      return;
    }
    fetchVotd(gid);
    fetchNextFromGroups(gid);
    computeWeeklyNudge(gid);
    computeStreak();
    loadVotdStar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gid]);

  // ---------- Groups ----------
  async function loadMyGroups(prefGid: string | null) {
    setLoadingGroups(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) { setGroups([]); setGid(null); setGname(null); return; }

      const { data: memberRows, error: mErr } = await supabase
        .from("group_members").select("group_id").eq("user_id", uid);
      if (mErr) throw mErr;

      const ids = Array.from(new Set((memberRows ?? []).map((r: any) => r.group_id))).filter(Boolean);
      if (ids.length === 0) { setGroups([]); setGid(null); setGname(null); return; }

      const { data: gRows, error: gErr } = await supabase.from("groups").select("id, name").in("id", ids);
      if (gErr) throw gErr;

      const list = (gRows ?? []) as Group[];
      setGroups(list);
      const found = prefGid && list.find((g) => g.id === prefGid);
      const chosen = found ?? list[0] ?? null;
      setGid(chosen?.id ?? null);
      setGname(chosen?.name ?? null);
      if (chosen?.id) localStorage.setItem("f180.currentGroupId", chosen.id);
    } catch {
      setGroups([]); setGid(null); setGname(null);
    } finally {
      setLoadingGroups(false);
    }
  }

  // ---------- VOTD ----------
  async function fetchVotd(groupId: string) {
    setLoadingVotd(true); setVotdError(null);
    try {
      const { data, error } = await supabase.functions.invoke("votd", { body: { group_id: groupId }});
      if (error) throw error;
      setVotd(data as Votd);
    } catch {
      setVotd(null);
      setVotdError("Couldn’t load Verse of the Day.");
    } finally { setLoadingVotd(false); }
  }
  function loadVotdStar() {
    if (!votd?.date || !currentUserId) { setVotdStarred(false); return; }
    try { setVotdStarred(localStorage.getItem(`f180.votd.star.${currentUserId}.${votd.date}`) === "1"); } catch { setVotdStarred(false); }
  }
  function toggleVotdStar() {
    if (!votd?.date || !currentUserId) return;
    const next = !votdStarred;
    setVotdStarred(next);
    try { localStorage.setItem(`f180.votd.star.${currentUserId}.${votd.date}`, next ? "1" : "0"); } catch {}
  }

  // ---------- Next Fireside (from groups) ----------
  async function fetchNextFromGroups(groupId: string) {
    setLoadingEvent(true);
    try {
      const { data, error } = await supabase
        .from("groups")
        .select("id,name,location,meeting_location,meeting_time,meeting_timezone,meeting_day")
        .eq("id", groupId)
        .single();

      if (error || !data) { setNextEvent(null); return; }

      const dayText: string | null   = data.meeting_day ?? null;
      const timeText: string | null  = data.meeting_time ?? null;
      const tz: string | null        = data.meeting_timezone ?? null;

      const starts_label = computeNextOccurrenceLabel(dayText, timeText, tz);

      const title: string | null = data.name ? `${data.name} — Fireside` : "Fireside Gathering";
      setNextEvent({
        id: data.id,
        title,
        starts_label,
        location: data.location ?? null,
        address: data.meeting_location ?? null,
        day_text: dayText,
      });
    } catch {
      setNextEvent(null);
    } finally {
      setLoadingEvent(false);
    }
  }

  // Build a label like "Wed, Sep 3, 7:00 PM (America/Chicago)" from day/time/tz
  function computeNextOccurrenceLabel(
    dayText?: string | null,
    timeText?: string | null,
    tz?: string | null
  ): string | null {
    if (!dayText || !timeText || !tz) return null;

    const targetDow = nameToDow(dayText); // 0..6 (Sun..Sat)
    if (targetDow == null) return null;

    // What day-of-week is it right now in that TZ?
    const now = new Date();
    const currentDowInTz = formatInTZ(now, tz, { weekday: "short" });
    const curIdx = nameToDow(currentDowInTz);
    if (curIdx == null) return null;

    // parse times like "19:30" or "7:30 PM"
    const [mh, mm] = parseTimeToHM(timeText); // 24h hour + minute
    const nowHM = parseTimeToHM(formatInTZ(now, tz, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }));

    let delta = (targetDow - curIdx + 7) % 7;
    // if it's the same day, but meeting time already passed in that TZ => push a week
    if (delta === 0 && (mh < nowHM[0] || (mh === nowHM[0] && mm <= nowHM[1]))) {
      delta = 7;
    }

    // approx next date by adding delta days in UTC, then formatting in TZ
    const approx = new Date(now);
    approx.setUTCDate(approx.getUTCDate() + delta);

    const dateLabel = formatInTZ(approx, tz, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    // Use the time as provided (we don't reformat it), just normalize spacing
    const cleanedTime = nicifyTimeLabel(timeText);

    return `${dateLabel}, ${cleanedTime} (${tz})`;
  }

  function nameToDow(name: string | null | undefined): number | null {
    if (!name) return null;
    const s = name.toLowerCase().slice(0, 3);
    const map: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    return s in map ? map[s] : null;
    }

  function parseTimeToHM(text: string): [number, number] {
    const t = text.trim().toUpperCase();
    // "HH:MM" 24h
    let m = t.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (m) return [parseInt(m[1], 10), parseInt(m[2], 10)];
    // "H:MM AM/PM"
    m = t.match(/^(\d{1,2}):([0-5]\d)\s*([AP]M)$/);
    if (m) {
      let h = parseInt(m[1], 10) % 12;
      if (m[3] === "PM") h += 12;
      return [h, parseInt(m[2], 10)];
    }
    // fallback 7 PM, 7PM, 7pm
    m = t.match(/^(\d{1,2})\s*([AP]M)$/);
    if (m) {
      let h = parseInt(m[1], 10) % 12;
      if (m[2] === "PM") h += 12;
      return [h, 0];
    }
    return [0, 0];
  }

  function nicifyTimeLabel(t: string) {
    // normalize "7:00 pm" -> "7:00 PM"
    return t.replace(/\b(am|pm)\b/i, (x) => x.toUpperCase());
  }

  function formatInTZ(date: Date, timeZone: string, opts: Intl.DateTimeFormatOptions) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, ...opts }).format(date);
    return parts;
  }

  // ---------- Weekly nudge ----------
  function computeWeeklyNudge(groupId: string) {
    const ideas = [
      "Text a brother a prayer today.",
      "Take a 10-minute walk and pray for your group.",
      "Share one verse with someone who needs it.",
      "Skip one comfort today and thank God instead.",
      "Write a 3-sentence gratitude list.",
      "Invite a man to next Fireside.",
      "Pray Psalm 23 slowly before bed.",
      "Fast one meal and pray for breakthrough.",
    ];
    const weekKey = getIsoWeekKey(new Date());
    const seed = `${weekKey}:${groupId}`;
    const idx = Math.abs(hash(seed)) % ideas.length;
    const doneKey = `f180.nudge.done.${groupId}.${weekKey}`;
    setNudge(ideas[idx]);
    setNudgeDone(localStorage.getItem(doneKey) === "1");
  }
  function toggleNudgeDone() {
    if (!gid) return;
    const weekKey = getIsoWeekKey(new Date());
    const doneKey = `f180.nudge.done.${gid}.${weekKey}`;
    const next = !nudgeDone;
    setNudgeDone(next);
    try { localStorage.setItem(doneKey, next ? "1" : "0"); } catch {}
  }

  // ---------- Streak ----------
  async function computeStreak() {
    try {
      if (!currentUserId) { setStreak(Number(localStorage.getItem("f180.streak") || "0")); return; }
      const since = new Date(); since.setDate(since.getDate() - 30);
      const { data } = await supabase
        .from("journal_entries")
        .select("created_at")
        .eq("user_id", currentUserId)
        .gte("created_at", since.toISOString());
      const daysSet = new Set<string>();
      (data ?? []).forEach((r: any) => daysSet.add((r.created_at ?? "").slice(0, 10)));
      setStreak(calcDailyStreak([...daysSet]));
    } catch {
      setStreak(Number(localStorage.getItem("f180.streak") || "0"));
    }
  }

function queueVotdForVerses() {
  if (!gid || !votd) return;
  try {
    // hand off to Verses page (it knows its own table/RLS)
    const payload = {
      group_id: gid,
      reference: votd.verse.ref,
      text: votd.verse.text,
      testament: votd.verse.testament, // "OT" | "NT"
      ts: Date.now(),
    };
    sessionStorage.setItem("f180.verses.toAdd", JSON.stringify(payload));
  } catch {}
  // go to the F180 Verses page (no double-hash!)
  window.location.hash = `/group/${gid}/verses-style?from=home`;
}

  // ---------- SOAP ----------
  const [soapObs, setSoapObs] = React.useState("");
  const [soapApp, setSoapApp] = React.useState("");
  const [soapPray, setSoapPray] = React.useState("");
  const [soapVis, setSoapVis] = React.useState<"private" | "group" | "org">("private");
  const [soapBusy, setSoapBusy] = React.useState(false);

  async function saveSoap() {
    if (!currentUserId || !gid || !votd) return;
    setSoapBusy(true); setMsg(null); setErr(null);
    try {
      const row = {
        user_id: currentUserId,
        group_id: gid,
        type: "soap",
        scripture_ref: votd.verse.ref,
        scripture_text: votd.verse.text,
        scripture_testament: votd.verse.testament,
        observation: soapObs,
        application: soapApp,
        prayer: soapPray,
        visibility: soapVis,
        created_at: new Date().toISOString(),
      };
      await supabase.from("journal_entries").insert(row);
      setMsg("Saved to journal.");

      // bump local streak
      try {
        const today = new Date().toISOString().slice(0, 10);
        const key = `f180.streak.lastday.${currentUserId}`;
        const last = localStorage.getItem(key);
        let newStreak = Number(localStorage.getItem("f180.streak") || "0");
        if (last !== today) newStreak = Math.max(1, newStreak + 1);
        localStorage.setItem(key, today);
        localStorage.setItem("f180.streak", String(newStreak));
        setStreak(newStreak);
      } catch {}
      setSoapObs(""); setSoapApp(""); setSoapPray("");
    } catch (e: any) {
      setErr(e?.message ?? "Couldn’t save to journal.");
    } finally { setSoapBusy(false); }
  }

  // ---------- helpers ----------
  function getIsoWeekKey(d: Date) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((date as any) - (yearStart as any)) / 86400000 + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2,"0")}`;
  }
  function hash(s: string) { let h = 0; for (let i=0;i<s.length;i++){ h=(h<<5)-h+s.charCodeAt(i); h|=0; } return h; }
  function calcDailyStreak(days: string[]) {
    const set = new Set(days); let streak = 0; const today = new Date();
    for (let i=0;i<60;i++){ const d=new Date(); d.setDate(today.getDate()-i); const k=d.toISOString().slice(0,10); if (set.has(k)) streak++; else break; }
    return streak;
  }

  // ---------- UI ----------
  return (
    <div className="f180 space-y-6">
      {/* Header / group picker */}
      <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-lg font-semibold tracking-tight text-[hsl(var(--card-foreground))]">Fireside — Home</div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-[hsl(var(--muted-foreground))]">Current group</label>
            <select
              className="h-9 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--popover))] px-3 text-sm text-[hsl(var(--popover-foreground))]"
              value={gid ?? ""}
              onChange={(e) => {
                const id = e.target.value || null;
                setGid(id);
                const picked = groups.find((g) => g.id === id);
                setGname(picked?.name ?? null);
                if (id) localStorage.setItem("f180.currentGroupId", id);
              }}
              disabled={loadingGroups || groups.length === 0}
            >
              {groups.length === 0 ? (
                <option value="">No groups</option>
              ) : (
                groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name ?? g.id}
                  </option>
                ))
              )}
            </select>

            {/* NEW: quick actions near the group name */}
            <button
              className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 text-sm hover:bg-[hsl(var(--muted))]"
              onClick={() => (window.location.hash = "/request-group-f180")}
            >
              Request group
            </button>
            <button
              className="h-9 rounded-lg border border-[hsl(var(--border))] bg-transparent px-3 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50"
              onClick={() => gid && (window.location.hash = `/group/${gid}/members-f180`)}
              disabled={!gid}
            >
              Members
            </button>
            <button
              className="h-9 rounded-lg border border-[hsl(var(--border))] bg-transparent px-3 text-sm text-white/80 hover:bg-white/10"
              onClick={() => (window.location.hash = "/admin/approvals-f180")}
            >
              Approvals
            </button>
          </div>
        </div>
        {gid && (<div className="mt-2 text-[11px] text-white/50">Selected: {gname ?? "Unnamed"} <span className="opacity-60">({gid})</span></div>)}
      </div>

      {/* Top row: Next Fireside / Nudge / Streak */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Next Fireside */}
        <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <div className="flex items-center gap-2">
            <CalendarIconRed className="w-5 h-5" />
            <div className="text-sm font-semibold text-[hsl(var(--card-foreground))]">Next Fireside</div>
            {nextEvent?.day_text && <Pill>{nextEvent.day_text}</Pill>}
          </div>
          <div className="mt-2 text-sm text-white/80">
            {!nextEvent ? (
              <span className="text-white/60">No meeting info found on this group.</span>
            ) : (
              <>
                <div className="font-medium">{nextEvent.title ?? "Fireside Gathering"}</div>
                {nextEvent.starts_label && <div>{nextEvent.starts_label}</div>}
                {nextEvent.location && <div className="text-white/70">Location: {nextEvent.location}</div>}
                {nextEvent.address && <div className="text-white/60 text-xs mt-1">Address: {nextEvent.address}</div>}
              </>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              className="h-8 rounded-md bg-white/90 text-black px-3 text-xs disabled:opacity-50"
              onClick={() => setErr("RSVP requires adding an RSVP table first.")}
              disabled={!gid || !nextEvent}
              title="Add an RSVP table to enable this"
            >
              RSVP
            </button>
            <button
              className="h-8 rounded-md border border-[hsl(var(--border))] bg-transparent px-3 text-xs text-white/80 hover:bg-white/10 disabled:opacity-50"
              onClick={() => setErr("Attendees requires RSVP storage (event_rsvps or group_rsvps).")}
              disabled
              title="Add an RSVP table to show attendees"
            >
              See who’s attending
            </button>
          </div>
        </div>

        {/* This Week’s Nudge */}
        <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <div className="text-sm font-semibold text-[hsl(var(--card-foreground))]">This Week’s Nudge</div>
          <div className="mt-2 text-sm text-white/80">{nudge || "—"}</div>
          <div className="mt-3">
            <label className="inline-flex items-center gap-2 text-xs text-white/80">
              <input type="checkbox" checked={nudgeDone} onChange={toggleNudgeDone} disabled={!gid} />
              Mark done
            </label>
          </div>
        </div>

        {/* Your Streak */}
        <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <div className="text-sm font-semibold text-[hsl(var(--card-foreground))]">Your Streak</div>
          <div className="mt-2 text-3xl font-bold text-white">{streak}</div>
          <div className="text-[11px] text-white/60">day{streak === 1 ? "" : "s"} in a row</div>
        </div>
      </div>

      {/* Middle row: Verse of the Day (full width) */}
      <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 md:p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold tracking-tight text-[hsl(var(--card-foreground))]">
            Verse of the Day {votd?.date && <span className="ml-2 text-[hsl(var(--muted-foreground))] font-normal">{votd.date}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              className={`h-8 rounded-md px-3 text-xs ${votdStarred ? "bg-yellow-300 text-black" : "bg-white/90 text-black"}`}
              onClick={toggleVotdStar}
              disabled={!gid || !votd || loadingVotd}
              title="Star this verse"
            >
              {votdStarred ? "Starred ★" : "Star ★"}
            </button>
            <button
              className="h-8 rounded-md border border-[hsl(var(--border))] bg-transparent px-3 text-xs text-white/80 hover:bg-white/10 disabled:opacity-50"
              onClick={() => gid && fetchVotd(gid)}
              disabled={loadingVotd || !gid}
            >
              Refresh
            </button>
            <button
  className="h-8 rounded-md bg-white/90 text-black px-3 text-xs disabled:opacity-50"
  onClick={queueVotdForVerses}
  disabled={loadingVotd || !gid || !votd}
  title="Add today’s verse to your Verses"
>
  Add to Verses
</button>

          </div>
        </div>
        {loadingVotd ? (
          <div className="mt-3 space-y-2 animate-pulse">
            <div className="h-4 w-40 bg-white/10 rounded" />
            <div className="h-4 w-5/6 bg-white/10 rounded" />
            <div className="h-4 w-2/3 bg-white/10 rounded" />
          </div>
        ) : votdError ? (
          <div className="mt-3 rounded-[var(--radius)] border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {votdError}
          </div>
        ) : votd ? (
          <div className="mt-3">
            <div className="text-[13px] font-semibold text-[hsl(var(--card-foreground))]">
              {votd.verse.ref}{" "}
              <span className="ml-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">
                {votd.verse.testament === "OT" ? "Old Testament" : "New Testament"}
              </span>
            </div>
            <div className="mt-1 text-sm text-white/80">{votd.plain_words}</div>
          </div>
        ) : (
          <div className="mt-3 text-sm text-white/70">No verse available.</div>
        )}
      </div>

      {/* Bottom row: Journal — SOAP (full width) */}
      <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 md:p-5">
        <div className="text-sm font-semibold tracking-tight text-[hsl(var(--card-foreground))]">Journal — SOAP</div>
        {votd ? (
          <div className="mt-2 text-xs text-white/60">
            Scripture: <span className="text-white/80 font-medium">{votd.verse.ref}</span>
          </div>
        ) : (
          <div className="mt-2 text-xs text-white/60">Scripture: —</div>
        )}

        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="col-span-1">
            <label className="block text-xs text-white/70 mb-1">Observation (I believe)</label>
            <textarea
              value={soapObs}
              onChange={(e) => setSoapObs(e.target.value)}
              className="min-h-[90px] w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--popover))] p-2 text-sm text-[hsl(var(--popover-foreground))]"
              placeholder="What is God saying here?"
            />
          </div>
          <div className="col-span-1">
            <label className="block text-xs text-white/70 mb-1">Application (I will)</label>
            <textarea
              value={soapApp}
              onChange={(e) => setSoapApp(e.target.value)}
              className="min-h-[90px] w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--popover))] p-2 text-sm text-[hsl(var(--popover-foreground))]"
              placeholder="What step will I take?"
            />
          </div>
          <div className="col-span-1">
            <label className="block text-xs text-white/70 mb-1">Prayer</label>
            <textarea
              value={soapPray}
              onChange={(e) => setSoapPray(e.target.value)}
              className="min-h-[90px] w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--popover))] p-2 text-sm text-[hsl(var(--popover-foreground))]"
              placeholder="Ask God for help."
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-xs text-white/70">Visibility:</label>
          <select
            value={soapVis}
            onChange={(e) => setSoapVis(e.target.value as any)}
            className="h-8 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--popover))] px-2 text-xs text-[hsl(var(--popover-foreground))]"
          >
            <option value="private">Private</option>
            <option value="group">Group</option>
            <option value="org">Organization</option>
          </select>
          <button
            className="ml-auto h-8 rounded-md bg-white/90 text-black px-3 text-xs disabled:opacity-50"
            onClick={saveSoap}
            disabled={!gid || !currentUserId || !votd || soapBusy}
          >
            {soapBusy ? "Saving…" : "Save to Journal"}
          </button>
        </div>
      </div>

      {/* Messages */}
      {msg && <div className="rounded-[var(--radius)] border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">{msg}</div>}
      {err && <div className="rounded-[var(--radius)] border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{err}</div>}
    </div>
  );
}
