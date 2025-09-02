// src/pages/Group/DevotionsTabF180.tsx
import * as React from "react";
import { Search, ChevronDown, ChevronRight, MoreHorizontal, Archive } from "lucide-react";

type DevTabKey = "devotions" | "highlights" | "bookmarks" | "archived";

type DevSeries = {
  id: string;
  title?: string | null;
  created_at?: string | null;
};

type DevEntry = {
  id: string;
  series_id?: string | null;
  title?: string | null;
  body?: string | null;
  content?: string | null;
  position?: number | null;
  scheduled_date?: string | null;
};

type DevEntryProgress = {
  entry_id: string;
  read_at?: string | null;
  archived_at?: string | null;
};

type DevHighlight = {
  id: string;
  entry_id: string;
  start: number;
  end: number;
  text: string;
  color?: string | null;
  visibility?: "private" | "group" | string | null;
  note?: string | null;
  created_at?: string | null;
};

type DevCollaborator = {
  id?: string;
  user_id: string;
  email?: string | null;
  role?: string | null;
  added_at?: string | null;
};

type DevInvite = {
  id: string;
  email?: string | null;
  token?: string | null;
  role?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
  max_uses?: number | null;
  used_count?: number | null;
};

type AggHighlight = {
  highlight: DevHighlight;
  entry: DevEntry;
  series: DevSeries;
};

export default function DevotionsTabF180({ groupId }: { groupId: string }) {
  const [tab, setTab] = React.useState<DevTabKey>("devotions");
  const DEV_TABS: DevTabKey[] = ["devotions", "highlights", "bookmarks", "archived"];

  // ---- Services loader
  const devSvcRef = React.useRef<any>(null);
  const [svcReady, setSvcReady] = React.useState(false);
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mod = await import("../../services/devotions");
        if (!mounted) return;
        devSvcRef.current = mod;
        setSvcReady(true);
      } catch (e) {
        console.error("[Devotions] failed to load services/devotions", e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ---- Data
  const [series, setSeries] = React.useState<DevSeries[]>([]);
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [entriesBySeries, setEntriesBySeries] = React.useState<Record<string, DevEntry[]>>({});
  const [progressMap, setProgressMap] = React.useState<Record<string, DevEntryProgress>>({});
  const [query, setQuery] = React.useState("");
  const [hideArchived, setHideArchived] = React.useState(true);

  // Selection per series (resume behavior)
  const [selectedEntryBySeries, setSelectedEntryBySeries] = React.useState<Record<string, string>>({});
  const getResumeId = React.useCallback((sid: string): string | null => {
    try { return localStorage.getItem(`f180_devo_last_entry_${sid}`); } catch { return null; }
  }, []);
  const setSelectedEntry = React.useCallback((sid: string, entryId: string | null) => {
    setSelectedEntryBySeries(prev => ({ ...prev, [sid]: entryId || "" }));
    if (entryId) { try { localStorage.setItem(`f180_devo_last_entry_${sid}`, String(entryId)); } catch {} }
  }, []);

  // Flags
  const [bookmarkedIds, setBookmarkedIds] = React.useState<Set<string>>(new Set());
  const [archivedIds, setArchivedIds] = React.useState<Set<string>>(new Set());
  const [bookmarkedBySeries, setBookmarkedBySeries] = React.useState<Record<string, DevEntry[]>>({});
  const [archivedBySeries, setArchivedBySeries] = React.useState<Record<string, DevEntry[]>>({});

  // Highlights (per entry)
  const [entryHighlights, setEntryHighlights] = React.useState<Record<string, DevHighlight[]>>({});
  const [highlightBusy, setHighlightBusy] = React.useState<Record<string, boolean>>({});
  const [highlightErr, setHighlightErr] = React.useState<Record<string, string>>({});
  // Aggregated my highlights (tab)
  const [myHighlights, setMyHighlights] = React.useState<AggHighlight[]>([]);
  const [hlLoading, setHlLoading] = React.useState(false);
  const [hlErr, setHlErr] = React.useState("");

  // Collaborators (per series panel open state)
  const [collabOpen, setCollabOpen] = React.useState<Record<string, boolean>>({});
  // Collaborators data maps
  const [collabBySeries, setCollabBySeries] = React.useState<Record<string, DevCollaborator[]>>({});
  const [invitesBySeries, setInvitesBySeries] = React.useState<Record<string, DevInvite[]>>({});
  const [collabBusy, setCollabBusy] = React.useState<Record<string, boolean>>({});
  const [collabErr, setCollabErr] = React.useState<Record<string, string>>({});
  const [inviteDraft, setInviteDraft] = React.useState<Record<string, string>>({});
  const [inviteRole, setInviteRole] = React.useState<Record<string, string>>({});

  // Series map for labels
  const seriesById = React.useMemo(() => {
    const m: Record<string, DevSeries> = {};
    for (const s of series) if (s?.id) m[String(s.id)] = s;
    return m;
  }, [series]);

  // ---- Service compat wrappers
  async function listSeriesForGroupCompat(gid: string): Promise<DevSeries[]> {
    const svc: any = devSvcRef.current;
    if (!svc) return [];
    try { return await svc.listSeriesForGroup(gid); } catch {}
    try { return await svc.listSeries(gid); } catch {}
    try { return await svc.listMySeries(gid); } catch {}
    return [];
  }
  async function listEntriesCompat(seriesId: string): Promise<DevEntry[]> {
    const svc: any = devSvcRef.current;
    if (!svc) return [];
    try { return await svc.listEntries(seriesId); } catch {}
    try { return await svc.listSeriesEntries(seriesId); } catch {}
    try { return await svc.entriesForSeries(seriesId); } catch {}
    return [];
  }
  async function getProgressCompat(entryId: string): Promise<DevEntryProgress | null> {
    const svc: any = devSvcRef.current;
    if (!svc) return null;
    try { return await svc.getMyEntryProgress(entryId); } catch { return null; }
  }
  async function markReadCompat(seriesId: string, entryId: string) {
    const svc: any = devSvcRef.current;
    if (!svc) return;
    if (svc?.upsertEntryProgress) {
      await svc.upsertEntryProgress(seriesId, entryId, { is_read: true });
      return;
    }
    if (svc?.markEntryRead) {
      await svc.markEntryRead(seriesId, entryId);
      return;
    }
  }
  async function toggleBookmarkEntryCompat(seriesId: string, entryId: string, bookmarked: boolean) {
    const svc: any = devSvcRef.current;
    if (!svc) return;
    try { return await svc.toggleBookmarkEntry(entryId, bookmarked); } catch {}
    try { return await svc.toggleBookmarkEntry(seriesId, entryId, bookmarked); } catch {}
    try { return await svc.bookmarkEntry(seriesId, entryId, bookmarked); } catch {}
    try { return await svc.toggleBookmark(entryId, bookmarked); } catch {}
  }
  async function toggleArchiveEntryCompat(seriesId: string, entryId: string, arch: boolean) {
    const svc: any = devSvcRef.current;
    if (!svc) return;
    try { return await svc.toggleArchiveEntry(entryId, arch); } catch {}
    try { return await svc.toggleArchiveEntry(seriesId, entryId, arch); } catch {}
    try { return await svc.archiveEntry(seriesId, entryId, arch); } catch {}
    try { return await svc.toggleArchive(entryId, arch); } catch {}
  }
  async function listFlagsForEntriesCompat(entryIds: string[]): Promise<{ bookmarked: string[]; archived: string[] }> {
    const svc: any = devSvcRef.current;
    const empty = { bookmarked: [], archived: [] as string[] };
    if (!svc) return empty;
    try { return await svc.listFlagsForEntries(entryIds); } catch {}
    return empty;
  }
  // Bookmarked/Archived lists (normalize into bySeries + ids)
  async function listMyBookmarkedEntriesCompat(gid: string): Promise<{ bySeries: Record<string, DevEntry[]>; ids: Set<string> }> {
    const svc: any = devSvcRef.current;
    const out = { bySeries: {} as Record<string, DevEntry[]>, ids: new Set<string>() };
    if (!svc) return out;
    try {
      const res = await (svc.listMyBookmarkedEntries?.(gid) ?? svc.listBookmarkedEntries?.(gid) ?? svc.bookmarksForGroup?.(gid));
      if (!res) return out;
      if (res.bySeries && res.ids) {
        return { bySeries: res.bySeries, ids: new Set(res.ids) };
      }
      const rows: any[] = Array.isArray(res) ? res : [];
      for (const r of rows) {
        const entry = coerceEntries([r.entry ?? r])[0];
        const sid = String(entry.series_id ?? r.series_id ?? r.sid ?? "");
        if (!sid || !entry?.id) continue;
        if (!out.bySeries[sid]) out.bySeries[sid] = [];
        out.bySeries[sid].push(entry);
        out.ids.add(String(entry.id));
      }
      return out;
    } catch {}
    return out;
  }
  async function listMyArchivedEntriesCompat(gid: string): Promise<{ bySeries: Record<string, DevEntry[]>; ids: Set<string> }> {
    const svc: any = devSvcRef.current;
    const out = { bySeries: {} as Record<string, DevEntry[]>, ids: new Set<string>() };
    if (!svc) return out;
    try {
      const res = await (svc.listMyArchivedEntries?.(gid) ?? svc.listArchivedEntries?.(gid) ?? svc.archivedForGroup?.(gid));
      if (!res) return out;
      if (res.bySeries && res.ids) {
        return { bySeries: res.bySeries, ids: new Set(res.ids) };
      }
      const rows: any[] = Array.isArray(res) ? res : [];
      for (const r of rows) {
        const entry = coerceEntries([r.entry ?? r])[0];
        const sid = String(entry.series_id ?? r.series_id ?? r.sid ?? "");
        if (!sid || !entry?.id) continue;
        if (!out.bySeries[sid]) out.bySeries[sid] = [];
        out.bySeries[sid].push(entry);
        out.ids.add(String(entry.id));
      }
      return out;
    } catch {}
    return out;
  }

  // Highlights compat
  async function listEntryHighlightsCompat(entryId: string): Promise<DevHighlight[]> {
    const svc: any = devSvcRef.current;
    if (!svc) return [];
    try { return await svc.listEntryHighlights(entryId); } catch {}
    try { return await svc.listHighlightsForEntry(entryId); } catch {}
    try { return await svc.getEntryHighlights(entryId); } catch {}
    return [];
  }
  async function addHighlightCompat(h: Partial<DevHighlight>): Promise<DevHighlight | null> {
    const svc: any = devSvcRef.current;
    if (!svc) return null;
    try { return await svc.addHighlight(h); } catch {}
    try { return await svc.createHighlight(h); } catch {}
    try { return await svc.upsertHighlight(h); } catch {}
    return null;
  }
  async function deleteHighlightCompat(id: string): Promise<void> {
    const svc: any = devSvcRef.current;
    if (!svc) return;
    try { return await svc.deleteHighlight(id); } catch {}
    try { return await svc.removeHighlight(id); } catch {}
  }

  // Collaborators compat (devotion_* tables)
  async function listSeriesCollaboratorsCompat(seriesId: string): Promise<DevCollaborator[]> {
    const svc: any = devSvcRef.current;
    if (!svc) return [];
    try { return await svc.listDevotionCollaborators(seriesId); } catch {}
    try { return await svc.listSeriesCollaborators(seriesId); } catch {}
    try { return await svc.listCollaboratorsForSeries(seriesId); } catch {}
    try { return await svc.listCollaborators(seriesId); } catch {}
    return [];
  }
  async function listSeriesInvitesCompat(seriesId: string): Promise<DevInvite[]> {
    const svc: any = devSvcRef.current;
    if (!svc) return [];
    try { return await svc.listDevotionInvites(seriesId); } catch {}
    try { return await svc.listSeriesInvites(seriesId); } catch {}
    try { return await svc.listInvitesForSeries(seriesId); } catch {}
    return [];
  }
  async function createSeriesInviteCompat(seriesId: string, role: string, email?: string): Promise<DevInvite | null> {
    const svc: any = devSvcRef.current;
    if (!svc) return null;
    try { return await svc.createDevotionInvite(seriesId, role, email); } catch {}
    try { return await svc.createSeriesInvite(seriesId, role, email); } catch {}
    try { return await svc.createInvite(seriesId, role, email); } catch {}
    return null;
  }
  async function revokeSeriesInviteCompat(inviteId: string): Promise<void> {
    const svc: any = devSvcRef.current;
    if (!svc) return;
    try { return await svc.revokeDevotionInvite(inviteId); } catch {}
    try { return await svc.revokeSeriesInvite(inviteId); } catch {}
    try { return await svc.revokeInvite(inviteId); } catch {}
  }
  async function removeSeriesCollaboratorCompat(seriesId: string, userId: string): Promise<void> {
    const svc: any = devSvcRef.current;
    if (!svc) return;
    try { return await svc.removeDevotionCollaborator(seriesId, userId); } catch {}
    try { return await svc.removeSeriesCollaborator(seriesId, userId); } catch {}
    try { return await svc.removeCollaborator(seriesId, userId); } catch {}
  }

  // ---- Normalizers
  function coerceEntries(raw: any): DevEntry[] {
    const rows: any[] = Array.isArray(raw) ? raw : [];
    const out: DevEntry[] = rows.map((r: any) => {
      const id = r?.id ?? r?.entry_id ?? r?.uuid ?? r?.eid ?? null;
      const entry: DevEntry = {
        id: id ? String(id) : "",
        series_id: r?.series_id ?? r?.sid ?? null,
        title: r?.title ?? r?.entry_title ?? null,
        body: r?.body_md ?? r?.body ?? r?.content ?? r?.text ?? r?.content_text ?? null,
        position: r?.position ?? r?.day_index ?? r?.day ?? null,
        scheduled_date: r?.scheduled_date ?? r?.date ?? null,
        content: r?.content ?? null,
      };
      return entry;
    }).filter((e) => !!e.id);
    return out;
  }

  function normalizeAggHighlights(rows: any[]): AggHighlight[] {
    const list = Array.isArray(rows) ? rows : [];
    const out: AggHighlight[] = [];
    for (const r of list) {
      const h = r.highlight || r.h || r;
      const e = r.entry || r.e || r.devotion_entry;
      const s = r.series || r.s || r.devotion_series;
      if (!h || !e || !s) continue;
      const hh: DevHighlight = {
        id: String(h.id ?? h.uuid ?? ""),
        entry_id: String(h.entry_id ?? e.id ?? ""),
        start: Number(h.start ?? 0),
        end: Number(h.end ?? 0),
        text: String(h.text ?? ""),
        color: h.color ?? null,
        visibility: h.visibility ?? null,
        note: h.note ?? null,
        created_at: h.created_at ?? null,
      };
      const ee: DevEntry = coerceEntries([e])[0];
      const ss: DevSeries = { id: String(s.id ?? ee.series_id ?? ""), title: s.title ?? null, created_at: s.created_at ?? null };
      if (hh.id && ee?.id && ss?.id) out.push({ highlight: hh, entry: ee, series: ss });
    }
    // dedupe/sort
    const seen = new Set<string>();
    const uniq: AggHighlight[] = [];
    for (const it of out) {
      const key = String(it.highlight.id);
      if (seen.has(key)) continue;
      seen.add(key);
      uniq.push(it);
    }
    uniq.sort((a, b) => {
      const ta = a.highlight.created_at ? Date.parse(a.highlight.created_at) : 0;
      const tb = b.highlight.created_at ? Date.parse(b.highlight.created_at) : 0;
      return tb - ta || (a.highlight.start - b.highlight.start);
    });
    return uniq;
  }

  // ---- Initial load
  React.useEffect(() => {
    if (!svcReady) return;
    (async () => {
      const rows = await listSeriesForGroupCompat(groupId);
      setSeries(rows ?? []);

      // preload bookmark/archive lists
      const bm = await listMyBookmarkedEntriesCompat(groupId);
      setBookmarkedBySeries(bm.bySeries);
      setBookmarkedIds(bm.ids);

      const ar = await listMyArchivedEntriesCompat(groupId);
      setArchivedBySeries(ar.bySeries);
      setArchivedIds(ar.ids);

      // make initial highlights feed attempt
      try {
        const svc: any = devSvcRef.current;
        if (svc?.listMyHighlightsForGroup) {
          const rows = await svc.listMyHighlightsForGroup(groupId);
          setMyHighlights(normalizeAggHighlights(rows));
        }
      } catch {}
    })();
  }, [groupId, svcReady]);

  // ---- Open/close and fetch entries (+collaborators)
  async function toggleSeries(sid: string) {
    const willOpen = !expanded[sid];
    setExpanded((m) => ({ ...m, [sid]: willOpen }));
    if (!svcReady) return;
    if (willOpen) {
      // entries & progress
      if (!entriesBySeries[sid]) {
        const raw = await listEntriesCompat(sid);
        const cleaned = coerceEntries(raw);
        const ordered = cleaned.slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        setEntriesBySeries((m) => ({ ...m, [sid]: ordered }));
        const resume = getResumeId(sid);
        const pick = (resume && ordered.find((r) => String(r.id) === String(resume)))
          ? String(resume) : (ordered[0] ? String(ordered[0].id) : "");
        if (pick) setSelectedEntry(sid, pick);
        // progress
        ordered.forEach(async (en) => {
          const pg = await getProgressCompat(String(en.id));
          if (pg) setProgressMap((m) => ({ ...m, [String(en.id)]: pg }));
        });
        // flags
        try {
          const ids = ordered.map(e => String(e.id));
          const flags = await listFlagsForEntriesCompat(ids);
          if (flags?.bookmarked?.length) setBookmarkedIds((prev) => new Set([...prev, ...flags.bookmarked.map(String)]));
          if (flags?.archived?.length) setArchivedIds((prev) => new Set([...prev, ...flags.archived.map(String)]));
        } catch {}
      }
      // collaborators
      try {
        setCollabBusy((m) => ({ ...m, [sid]: true }));
        const [cols, invs] = await Promise.all([
          listSeriesCollaboratorsCompat(sid),
          listSeriesInvitesCompat(sid),
        ]);
        setCollabBySeries((m) => ({ ...m, [sid]: Array.isArray(cols) ? cols : [] }));
        setInvitesBySeries((m) => ({ ...m, [sid]: Array.isArray(invs) ? invs : [] }));
      } catch (e: any) {
        setCollabErr((m) => ({ ...m, [sid]: String(e?.message ?? e ?? "Failed to load collaborators") }));
      } finally {
        setCollabBusy((m) => ({ ...m, [sid]: false }));
      }
    }
  }

  // ---- Highlights: load when selected entry changes
  React.useEffect(() => {
    const sidList = Object.keys(selectedEntryBySeries);
    if (sidList.length === 0) return;
    const sid = sidList[sidList.length - 1];
    const eid = selectedEntryBySeries[sid];
    if (!eid) return;
    (async () => {
      const list = await listEntryHighlightsCompat(String(eid));
      setEntryHighlights((m) => ({ ...m, [String(eid)]: Array.isArray(list) ? list : [] }));
    })();
  }, [selectedEntryBySeries, svcReady]);

  // ---- Helpers
  function visibleSeriesList() {
    return series.filter((s) => {
      if (tab === "devotions" && hideArchived) {
        const entries = entriesBySeries[s.id] || [];
        const allArchived = entries.length > 0 && entries.every((e) => archivedIds.has(e.id));
        if (allArchived) return false;
      }
      if (!query) return true;
      return (s.title || "").toLowerCase().includes(query.toLowerCase());
    });
  }
  function selectedEntryForSeries(sid: string): DevEntry | null {
    const eid = selectedEntryBySeries[sid] || "";
    const arr = entriesBySeries[sid] || [];
    return arr.find((x) => String(x.id) === String(eid)) || null;
  }
  function openSeriesAndSelect(seriesId: string, entryId: string) {
    setTab("devotions");
    setExpanded((m) => ({ ...m, [seriesId]: true }));
    setSelectedEntry(seriesId, entryId);
  }

  // ---- Mark as read (manual button); protect against duplicates
  const pendingMark = React.useRef<Set<string>>(new Set());
  async function safeMarkRead(seriesId: string, entryId: string) {
    const key = seriesId + "::" + entryId;
    if (pendingMark.current.has(key)) return;
    pendingMark.current.add(key);
    try {
      // pre-check
      try {
        const existing = await getProgressCompat(entryId);
        if (existing && existing.read_at) return;
      } catch {}
      await markReadCompat(seriesId, entryId);
      setProgressMap((m) => ({ ...m, [entryId]: { entry_id: entryId, read_at: new Date().toISOString() } }));
    } catch (e) {
      const msg = String((e as any)?.message ?? e ?? "");
      const code = String((e as any)?.code ?? "");
      if (code !== "23505" && !msg.includes("duplicate key")) {
        console.warn("[Devotions] mark read failed", e);
      }
    } finally {
      pendingMark.current.delete(key);
    }
  }

  async function onToggleBookmark(seriesId: string, entryId: string) {
    const isOn = bookmarkedIds.has(entryId);
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (isOn) next.delete(entryId); else next.add(entryId);
      return next;
    });
    try {
      await toggleBookmarkEntryCompat(seriesId, entryId, !isOn);
      const bm = await listMyBookmarkedEntriesCompat(groupId);
      setBookmarkedBySeries(bm.bySeries);
      setBookmarkedIds(bm.ids);
    } catch (e) {
      // revert
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        if (isOn) next.add(entryId); else next.delete(entryId);
        return next;
      });
      console.warn("[Devotions] bookmark toggle failed", e);
    }
  }

  async function onToggleArchive(seriesId: string, entryId: string) {
    const isOn = archivedIds.has(entryId);
    setArchivedIds((prev) => {
      const next = new Set(prev);
      if (isOn) next.delete(entryId); else next.add(entryId);
      return next;
    });
    try {
      await toggleArchiveEntryCompat(seriesId, entryId, !isOn);
      const ar = await listMyArchivedEntriesCompat(groupId);
      setArchivedBySeries(ar.bySeries);
      setArchivedIds(ar.ids);
    } catch (e) {
      // revert
      setArchivedIds((prev) => {
        const next = new Set(prev);
        if (isOn) next.add(entryId); else next.delete(entryId);
        return next;
      });
      console.warn("[Devotions] archive toggle failed", e);
    }
  }

  async function refreshMyHighlights() {
    setHlLoading(true);
    setHlErr("");
    try {
      const svc: any = devSvcRef.current;
      const rows = (await (svc?.listMyHighlightsForGroup?.(groupId))) ?? [];
      setMyHighlights(normalizeAggHighlights(rows));
    } catch (e: any) {
      setHlErr(String(e?.message ?? e ?? "Failed to load highlights"));
    } finally {
      setHlLoading(false);
    }
  }

  // ---- Render
  return (
    <div className="mx-auto max-w-6xl px-3 md:px-6">
      {/* Header / Tabs */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Devotions (preview)</h1>
          <div className="text-xs md:text-sm opacity-70">Daily cadence • episode rail • collab per series</div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-2 mb-4">
        {DEV_TABS.map((key) => {
          const active = tab === key;
          const label = key === "devotions" ? "Devotions" : key.charAt(0).toUpperCase() + key.slice(1);
          const btnStyle: React.CSSProperties = active
            ? { backgroundColor: "hsl(var(--primary))", borderColor: "hsl(var(--primary))", color: "#fff" }
            : { backgroundColor: "hsl(var(--secondary))", borderColor: "hsl(var(--border))" };
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="px-3 py-1.5 rounded-full text-sm border"
              style={btnStyle}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Filter row (Devotions tab) */}
      {tab === "devotions" && (
        <div className="sticky top-2 z-10 p-3 md:p-4 mb-3 border rounded-2xl bg-[hsl(var(--card))]/90 border-[hsl(var(--border))] backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 opacity-70" />
              <input
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-sm"
                placeholder="Search my devotions…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] cursor-pointer">
              <input
                type="checkbox"
                className="accent-[hsl(var(--primary))]"
                checked={hideArchived}
                onChange={(e) => setHideArchived(e.target.checked)}
              />
              Hide archived
            </label>
          </div>
        </div>
      )}

      {tab === "devotions" ? (
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-4">
          {/* LEFT */}
          <div className="rounded-2xl border border-neutral-700 bg-transparent">
            {!svcReady ? (
              <div className="p-4 text-sm opacity-70">Loading…</div>
            ) : visibleSeriesList().length === 0 ? (
              <div className="p-4 text-sm opacity-70">No devotion series found for this group.</div>
            ) : (
              <ul className="divide-y divide-neutral-800">
                {visibleSeriesList().map((s) => {
                  const open = !!expanded[s.id];
                  const entries = (entriesBySeries[s.id] ?? []).filter((en) => !!en && !!en.id);
                  const activeId = selectedEntryBySeries[s.id] || getResumeId(s.id) || (entries[0]?.id ? String(entries[0].id) : "");
                  const activeIdx = entries.length > 0 ? entries.findIndex((en) => String(en.id) === String(activeId)) : -1;
                  const selected = activeIdx >= 0 ? entries[activeIdx] : null;
                  const hasPrev = activeIdx > 0;
                  const hasNext = activeIdx >= 0 && activeIdx < entries.length - 1;

                  return (
                    <li key={String(s.id)} className="p-3 md:p-4">
                      {/* Header row like Study */}
                      <div className="flex items-center gap-3">
                        <button
                          className="rounded-lg border border-neutral-700 px-2 py-1"
                          onClick={() => toggleSeries(String(s.id))}
                          aria-label={open ? "Collapse" : "Expand"}
                          title={open ? "Collapse" : "Expand"}
                        >
                          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="text-sm md:text-base font-medium">{s.title || "Devotion Series"}</div>
                          <div className="text-xs opacity-70 truncate">
                            {(entries?.length ?? 0)} days
                          </div>
                        </div>

                        {/* Continue */}
                        {open && entries.length > 0 && (
                          <button
                            type="button"
                            className="text-xs rounded-xl border px-3 py-1.5 bg-[hsl(var(--secondary))]"
                            onClick={() => {
                              const resume = getResumeId(String(s.id));
                              const target =
                                (resume && entries.find((e) => String(e.id) === String(resume))?.id) || entries[0]?.id || null;
                              if (target) setSelectedEntry(String(s.id), String(target));
                            }}
                          >
                            Continue
                          </button>
                        )}

                        {/* Collaborators link */}
                        <button
                          type="button"
                          className="text-sm underline"
                          onClick={() => setCollabOpen((m) => ({ ...m, [s.id]: !m[s.id] }))}
                        >
                          {collabOpen[s.id] ? "Hide collaborators" : "Collaborators"}
                        </button>

                        <button className="rounded-xl border px-2 py-1.5 bg-[hsl(var(--secondary))]" title="More">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Collaboration panel */}
                      {collabOpen[s.id] && (
                        <div className="mt-3 rounded-lg border border-neutral-700 bg-[hsl(var(--secondary))] p-3">
                          {/* Inline panel modeled after Study */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-medium">Collaborators</div>
                            <button type="button" className="text-xs underline" onClick={() => toggleSeries(String(s.id))}>
                              Refresh
                            </button>
                          </div>
                          {(() => {
                            const sid = String(s.id);
                            const loading = !!collabBusy[sid];
                            const err = collabErr[sid];
                            const cols = collabBySeries[sid] ?? [];
                            const invs = invitesBySeries[sid] ?? [];
                            return (
                              <div className="mt-2 grid gap-3">
                                {loading && <div className="text-xs opacity-70">Loading…</div>}
                                {!!err && <div className="text-xs text-red-400">{err}</div>}

                                <div>
                                  <div className="text-xs opacity-70 mb-1">Current collaborators</div>
                                  {cols.length === 0 ? (
                                    <div className="text-xs opacity-70">No collaborators yet.</div>
                                  ) : (
                                    <ul className="space-y-1">
                                      {cols.map((c) => (
                                        <li key={String(c.user_id)} className="flex items-center justify-between gap-2">
                                          <div className="min-w-0">
                                            <div className="text-sm">
                                              {c.email || c.user_id.slice(0, 8)}{" "}
                                              {c.role && <span className="ml-1 text-xs opacity-60">({c.role})</span>}
                                            </div>
                                          </div>
                                          <button
                                            className="text-xs rounded-lg border px-2 py-1"
                                            onClick={async () => {
                                              try { await removeSeriesCollaboratorCompat(sid, c.user_id); } catch {}
                                              // refresh
                                              try {
                                                const [cols2, invs2] = await Promise.all([
                                                  listSeriesCollaboratorsCompat(sid),
                                                  listSeriesInvitesCompat(sid),
                                                ]);
                                                setCollabBySeries((m) => ({ ...m, [sid]: Array.isArray(cols2) ? cols2 : [] }));
                                                setInvitesBySeries((m) => ({ ...m, [sid]: Array.isArray(invs2) ? invs2 : [] }));
                                              } catch {}
                                            }}
                                          >
                                            Remove
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>

                                <div>
                                  <div className="text-xs opacity-70 mb-1">Active invites</div>
                                  {invs.length === 0 ? (
                                    <div className="text-xs opacity-70">No active invites.</div>
                                  ) : (
                                    <ul className="space-y-1">
                                      {invs.map((iv) => (
                                        <li key={String(iv.id)} className="flex items-center justify-between gap-2">
                                          <div className="min-w-0">
                                            <div className="text-sm">
                                              {(iv.email ? `${iv.email} (locked)` : "Open")} • {iv.role || "viewer"}
                                            </div>
                                            <div className="text-[11px] opacity-60">
                                              Created {iv.created_at ? new Date(iv.created_at).toLocaleString() : ""}
                                              {iv.expires_at ? ` • Expires ${new Date(iv.expires_at).toLocaleDateString()}` : ""}
                                              {iv.revoked_at ? ` • Revoked` : ""}
                                              {iv.max_uses ? ` • Uses ${(iv.used_count ?? 0)}/${iv.max_uses}` : ""}
                                            </div>
                                          </div>
                                          <div className="shrink-0 flex items-center gap-2">
                                            {iv.token && (
                                              <button
                                                className="text-xs rounded-lg border px-2 py-1"
                                                onClick={async () => {
                                                  try {
                                                    await navigator.clipboard?.writeText(`${location.origin}/#/accept-devotion-invite?token=${encodeURIComponent(String(iv.token))}`);
                                                    alert("Copied link");
                                                  } catch {
                                                    alert("Couldn’t copy");
                                                  }
                                                }}
                                              >
                                                Copy link
                                              </button>
                                            )}
                                            <button
                                              className="text-xs rounded-lg border px-2 py-1"
                                              onClick={async () => {
                                                try { await revokeSeriesInviteCompat(String(iv.id)); } catch {}
                                                // refresh
                                                try {
                                                  const invs2 = await listSeriesInvitesCompat(sid);
                                                  setInvitesBySeries((m) => ({ ...m, [sid]: Array.isArray(invs2) ? invs2 : [] }));
                                                } catch {}
                                              }}
                                            >
                                              Revoke
                                            </button>
                                          </div>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>

                                <div>
                                  <div className="text-xs opacity-70 mb-1">Create invite</div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <select
                                      className="text-xs rounded-xl border border-neutral-700 bg-[hsl(var(--secondary))] px-2 py-1"
                                      value={inviteRole[sid] ?? "viewer"}
                                      onChange={(e) => setInviteRole((m) => ({ ...m, [sid]: e.target.value }))}
                                    >
                                      <option value="viewer">Viewer</option>
                                      <option value="editor">Editor</option>
                                    </select>
                                    <input
                                      type="email"
                                      placeholder="Lock to email (optional)"
                                      className="text-xs rounded-xl border border-neutral-700 bg-[hsl(var(--secondary))] px-2 py-1"
                                      value={inviteDraft[sid] ?? ""}
                                      onChange={(e) => setInviteDraft((m) => ({ ...m, [sid]: e.target.value }))}
                                    />
                                    <button
                                      className="text-xs rounded-lg border px-2 py-1"
                                      onClick={async () => {
                                        const email = (inviteDraft[sid] ?? "").trim() || undefined;
                                        const role = inviteRole[sid] ?? "viewer";
                                        try { await createSeriesInviteCompat(sid, role, email); } catch {}
                                        setInviteDraft((m) => ({ ...m, [sid]: "" }));
                                        // refresh
                                        try {
                                          const invs2 = await listSeriesInvitesCompat(sid);
                                          setInvitesBySeries((m) => ({ ...m, [sid]: Array.isArray(invs2) ? invs2 : [] }));
                                        } catch {}
                                      }}
                                    >
                                      Create invite
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* EPISODE RAIL + READER */}
                      {open && (
                        <div className="mt-3 space-y-4">
                          {/* Episode rail */}
                          <div className="rounded-xl border border-neutral-700 bg-[hsl(var(--secondary))] p-2 overflow-x-auto">
                            <div className="flex items-center gap-2">
                              {entries.map((e, idx) => {
                                const isActive = String(activeId) === String(e.id);
                                const read = !!progressMap[String(e.id)]?.read_at;
                                const isBookmarked = bookmarkedIds.has(String(e.id));
                                const isArchived = archivedIds.has(String(e.id));
                                return (
                                  <button
                                    key={String(e.id)}
                                    onClick={() => setSelectedEntry(String(s.id), String(e.id))}
                                    className={`text-xs rounded-full border px-3 py-1.5 whitespace-nowrap transition ${isActive ? "bg-red-600 border-red-600 text-white" : "bg-neutral-900 border-neutral-700"} ${isArchived ? "opacity-60" : ""}`}
                                    title={e.title || `Day ${e.position ?? idx + 1}`}
                                  >
                                    <span className="mr-2 opacity-80">Day {e.position ?? idx + 1}</span>
                                    {read && <span className="inline-block h-2 w-2 rounded-full bg-white/80 align-middle" />}
                                    {isBookmarked && !read && <span className="inline-block h-2 w-2 rounded-full bg-black/60 align-middle" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Reader */}
                          <div className="rounded-lg border border-neutral-700 p-3 bg-[hsl(var(--secondary))]">
                            {selected ? (
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-sm font-semibold">{selected.title || `Day ${selected.position ?? (activeIdx + 1)}`}</div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      className="text-xs rounded-lg border px-2 py-1"
                                      disabled={!hasPrev}
                                      onClick={() => {
                                        if (!hasPrev) return;
                                        const prev = entries[activeIdx - 1];
                                        setSelectedEntry(String(s.id), String(prev.id));
                                      }}
                                    >Prev</button>
                                    <button
                                      className="text-xs rounded-lg border px-2 py-1"
                                      disabled={!hasNext}
                                      onClick={() => {
                                        if (!hasNext) return;
                                        const next = entries[activeIdx + 1];
                                        setSelectedEntry(String(s.id), String(next.id));
                                      }}
                                    >Next</button>
                                    <button
                                      className="text-xs rounded-lg border px-2 py-1"
                                      disabled={!!progressMap[String(selected.id)]?.read_at}
                                      onClick={async () => await safeMarkRead(String(s.id), String(selected.id))}
                                    >{progressMap[String(selected.id)]?.read_at ? "Read" : "Mark read"}</button>
                                    <button
                                      className="text-xs rounded-lg border px-2 py-1"
                                      onClick={() => onToggleBookmark(String(s.id), String(selected.id))}
                                    >{bookmarkedIds.has(String(selected.id)) ? "Bookmarked" : "Bookmark"}</button>
                                    <button
                                      className="text-xs rounded-lg border px-2 py-1"
                                      onClick={() => onToggleArchive(String(s.id), String(selected.id))}
                                      title={archivedIds.has(String(selected.id)) ? "Unarchive this devotion" : "Archive this devotion"}
                                    >
                                      <div className="flex items-center gap-1">
                                        <Archive className="h-3.5 w-3.5" /> {archivedIds.has(String(selected.id)) ? "Unarchive" : "Archive"}
                                      </div>
                                    </button>
                                  </div>
                                </div>

                                {/* Sentence-click highlighting */}
                                <div className="prose prose-invert max-w-none text-sm leading-6">
                                  {(() => {
                                    const full: string =
                                      ((selected as any)?.body_md || selected.body || selected.content || (selected as any)?.text || (selected as any)?.content_text || "") as string;
                                    const myHs = entryHighlights[String(selected.id)] ?? [];
                                    const byKey = new Set(myHs.map(h => `${h.start}:${h.end}`));
                                    const paras = full.split("\n\n");
                                    let offset = 0;
                                    function sentenceSpans(s: string) {
                                      const spans: Array<{ text: string; start: number; end: number }> = [];
                                      const re = /([^.!?]+[.!?]|[^.!?]+$)/g;
                                      let m: RegExpExecArray | null;
                                      while ((m = re.exec(s)) !== null) {
                                        const raw = m[0];
                                        const start = offset + m.index;
                                        const end = start + raw.length;
                                        const trimmed = raw.trim();
                                        const leftPad = raw.indexOf(trimmed);
                                        const rightTrim = raw.length - (leftPad + trimmed.length);
                                        spans.push({ text: trimmed, start: start + leftPad, end: end - rightTrim });
                                      }
                                      return spans;
                                    }
                                    const nodes: React.ReactNode[] = [];
                                    for (let i = 0; i < paras.length; i++) {
                                      const p = paras[i];
                                      const spans = sentenceSpans(p);
                                      const children = spans.map((sp, si) => {
                                        const already = byKey.has(`${sp.start}:${sp.end}`);
                                        const cls = already ? "bg-yellow-600/30 rounded px-0.5 cursor-default" : "cursor-pointer hover:bg-yellow-600/20 rounded px-0.5";
                                        const click = async () => {
                                          if (already) return; // no toggle
                                          const eid = String(selected.id);
                                          setHighlightBusy((m) => ({ ...m, [eid]: true }));
                                          setHighlightErr((m) => ({ ...m, [eid]: "" }));
                                          try {
                                            const created = await addHighlightCompat({
                                              entry_id: eid,
                                              start: sp.start,
                                              end: sp.end,
                                              text: sp.text,
                                              color: "#fde047",
                                              visibility: "private"
                                            });
                                            const rec: DevHighlight = created ?? {
                                              id: `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                                              entry_id: eid, start: sp.start, end: sp.end, text: sp.text, color: "#fde047", visibility: "private"
                                            };
                                            setEntryHighlights((m) => ({ ...m, [eid]: [...(m[eid] ?? []), rec] }));
                                            setMyHighlights((arr) => ([{ highlight: rec, entry: selected, series: s }, ...arr]));
                                          } catch (e: any) {
                                            setHighlightErr((m) => ({ ...m, [eid]: String(e?.message ?? e ?? "Failed to add highlight") }));
                                          } finally {
                                            setHighlightBusy((m) => ({ ...m, [eid]: false }));
                                          }
                                        };
                                        return <span key={si} className={cls} onClick={click}>{sp.text + (si === spans.length - 1 ? "" : " ")}</span>;
                                      });
                                      nodes.push(<p key={i}>{children}</p>);
                                      offset += p.length + 2; // account for \n\n
                                    }
                                    return nodes;
                                  })()}
                                </div>

                                {/* My highlights list */}
                                <div className="mt-3 rounded border border-neutral-700 p-2 bg-black/20">
                                  <div className="text-xs font-semibold mb-2">My highlights for this entry</div>
                                  {(() => {
                                    const eid = String(selected.id);
                                    const list = entryHighlights[eid] ?? [];
                                    if (!list.length) return <div className="text-xs opacity-70">No highlights yet. Click a sentence above to add one.</div>;
                                    return (
                                      <ul className="space-y-2">
                                        {list.slice().sort((a,b) => (b.created_at ? Date.parse(b.created_at) : 0) - (a.created_at ? Date.parse(a.created_at) : 0) || a.start - b.start)
                                          .map((h) => (
                                            <li key={h.id} className="rounded md:border md:border-neutral-700 md:p-2">
                                              <div className="text-sm"><span className="bg-yellow-600/20 rounded px-1">{h.text}</span></div>
                                              <div className="mt-1 flex items-center gap-2">
                                                <span className="text-[10px] uppercase tracking-wide opacity-60">{h.visibility || "private"}</span>
                                                <button
                                                  className="text-xs rounded-lg border px-2 py-1"
                                                  onClick={async () => {
                                                    try { await deleteHighlightCompat(h.id); } catch {}
                                                    setEntryHighlights((m) => ({ ...m, [eid]: (m[eid] ?? []).filter((x) => x.id !== h.id) }));
                                                    setMyHighlights((arr) => arr.filter((it) => String(it.highlight.id) !== String(h.id)));
                                                  }}
                                                >Delete</button>
                                              </div>
                                            </li>
                                        ))}
                                      </ul>
                                    );
                                  })()}
                                  {highlightBusy[String(selected.id)] && (<div className="mt-2 text-xs opacity-70">Saving…</div>)}
                                  {!!highlightErr[String(selected.id)] && (<div className="mt-2 text-xs text-red-400">{highlightErr[String(selected.id)]}</div>)}
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm opacity-70">Select a day above to begin.</div>
                            )}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* RIGHT sidebar (kept lightweight) */}
          <aside className="rounded-2xl border border-neutral-700 bg-transparent p-3">
            <div className="space-y-4">
              <div className="rounded-xl border border-neutral-700 p-3 bg-[hsl(var(--secondary))]">
                <div className="text-sm font-semibold mb-2">Add Devotion</div>
                <div className="text-xs opacity-80 mb-2">Create a new devotion series or generate one with AI.</div>
                <div className="grid gap-2">
                  <input
                    type="text"
                    placeholder="Series title"
                    className="w-full rounded-md border border-neutral-700 bg-transparent px-2 py-1 text-sm"
                    onChange={(e) => (window as any).__f180_dev_title = e.target.value}
                  />
                  <textarea
                    placeholder="Optional prompt for AI (theme, focus verse, tone)…"
                    rows={3}
                    className="w-full rounded-md border border-neutral-700 bg-transparent px-2 py-1 text-sm"
                    onChange={(e) => (window as any).__f180_dev_prompt = e.target.value}
                  />
                  <div className="flex items-center gap-2">
                    <select
                      className="rounded-md border border-neutral-700 bg-transparent px-2 py-1 text-sm"
                      onChange={(e) => (window as any).__f180_dev_cadence = e.target.value}
                      defaultValue="daily"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                    <input
                      type="date"
                      className="rounded-md border border-neutral-700 bg-transparent px-2 py-1 text-sm"
                      onChange={(e) => (window as any).__f180_dev_start = e.target.value}
                    />
                  </div>
                  <button
                    className="text-sm rounded-lg border px-3 py-1.5"
                    onClick={async () => {
                      const svc: any = devSvcRef.current;
                      const title = String((window as any).__f180_dev_title || "").trim();
                      const prompt = String((window as any).__f180_dev_prompt || "").trim();
                      const cadence = String((window as any).__f180_dev_cadence || "daily");
                      const start = String((window as any).__f180_dev_start || "");
                      if (!title) { alert("Please enter a series title"); return; }
                      try {
                        if (svc?.generateDevotionSeriesCompat) {
                          await svc.generateDevotionSeriesCompat({ groupId, title, prompt, cadence, startDate: start });
                        } else if (svc?.generateSeries) {
                          await svc.generateSeries({ groupId, title, prompt, cadence, startDate: start });
                        } else {
                          alert("Generator wiring uses your existing services/devotions. If this does nothing, we can wire the edge function next.");
                        }
                        const rows2 = await listSeriesForGroupCompat(groupId);
                        setSeries(rows2 ?? []);
                      } catch (e) {
                        console.warn("[Devotions] generate failed", e);
                        alert("Generate failed. We can wire the exact edge function your app uses next.");
                      }
                    }}
                  >Generate series</button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : tab === "highlights" ? (
        <div className="rounded-2xl border border-neutral-700 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">My Highlights</div>
            <button className="text-xs rounded-lg border px-2 py-1" onClick={refreshMyHighlights}>
              Refresh
            </button>
          </div>
          {hlLoading ? (
            <div className="text-sm opacity-70">Loading…</div>
          ) : hlErr ? (
            <div className="text-sm text-red-400">{hlErr}</div>
          ) : myHighlights.length === 0 ? (
            <div className="text-sm opacity-70">You have no highlights yet.</div>
          ) : (
            <ul className="space-y-2">
              {myHighlights.map((it) => (
                <li key={String(it.highlight.id)} className="rounded-lg border border-neutral-700 p-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs opacity-70 mb-1">
                      <span className="font-medium">{it.series.title || "Series"}</span>
                      {" · "}
                      <span>Day {it.entry.position ?? ""}</span>
                    </div>
                    <div className="text-sm">
                      <span className="bg-yellow-600/20 rounded px-1">{it.highlight.text}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      className="text-xs rounded-lg border px-2 py-1"
                      onClick={() => openSeriesAndSelect(String(it.series.id), String(it.entry.id))}
                    >Open</button>
                    <button
                      className="text-xs rounded-lg border px-2 py-1"
                      onClick={async () => {
                        try { await deleteHighlightCompat(String(it.highlight.id)); } catch {}
                        setMyHighlights((arr) => arr.filter((x) => String(x.highlight.id) !== String(it.highlight.id)));
                        // also nuke from entry-specific cache
                        setEntryHighlights((m) => {
                          const eid = String(it.entry.id);
                          const list = (m[eid] ?? []).filter((x) => String(x.id) !== String(it.highlight.id));
                          return { ...m, [eid]: list };
                        });
                      }}
                    >Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : tab === "bookmarks" ? (
        <div className="rounded-2xl border border-neutral-700 p-3">
          <div className="text-sm font-semibold mb-2">My Bookmarks</div>
          {Object.entries(bookmarkedBySeries).length === 0 ? (
            <div className="text-sm opacity-70">You haven’t bookmarked any devotions yet.</div>
          ) : (
            <ul className="space-y-3">
              {Object.entries(bookmarkedBySeries).map(([sid, entries]) => (
                <li key={sid} className="rounded-xl border border-neutral-700 p-3">
                  <div className="text-sm font-medium mb-2">{seriesById[sid]?.title || "Devotion Series"}</div>
                  <div className="grid gap-2">
                    {entries.map((e) => (
                      <div key={String(e.id)} className="rounded-lg border border-neutral-700 p-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{e.title || `Day ${e.position ?? ""}`}</div>
                          <div className="text-xs opacity-80 truncate">Day {e.position ?? ""}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button className="text-xs rounded-lg border px-2 py-1" onClick={() => openSeriesAndSelect(String(sid), String(e.id))}>Open</button>
                          <button
                            className="text-xs rounded-lg border px-2 py-1"
                            onClick={() => onToggleBookmark(String(sid), String(e.id))}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-neutral-700 p-3">
          <div className="text-sm font-semibold mb-2">Archived</div>
          {Object.entries(archivedBySeries).length === 0 ? (
            <div className="text-sm opacity-70">No archived devotions.</div>
          ) : (
            <ul className="space-y-3">
              {Object.entries(archivedBySeries).map(([sid, entries]) => (
                <li key={sid} className="rounded-xl border border-neutral-700 p-3">
                  <div className="text-sm font-medium mb-2">{seriesById[sid]?.title || "Devotion Series"}</div>
                  <div className="grid gap-2">
                    {entries.map((e) => (
                      <div key={String(e.id)} className="rounded-lg border border-neutral-700 p-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{e.title || `Day ${e.position ?? ""}`}</div>
                          <div className="text-xs opacity-80 truncate">Day {e.position ?? ""}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button className="text-xs rounded-lg border px-2 py-1" onClick={() => openSeriesAndSelect(String(sid), String(e.id))}>Open</button>
                          <button
                            className="text-xs rounded-lg border px-2 py-1"
                            onClick={() => onToggleArchive(String(sid), String(e.id))}
                          >
                            Unarchive
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
