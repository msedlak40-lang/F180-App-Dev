import React from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  // series + entries
  listSeriesForGroup,
  listEntries,
  updateEntry,
  deleteEntry,
  mySeriesCapabilities,
  createSeries,
  bulkAddEntries,
  // highlights
  listEntryHighlights,
  createEntryHighlight,
  deleteEntryHighlight,
  // collaborators & invites
  listCollaborators,
  removeCollaboratorByUser,
  listInvites,
  revokeInvite,
  createInviteLinkSimple,
  // AI generation
  generateDevotionSeries,
  // progress (NEW)
  getMyProgressForSeries,
  markEntryRead,
  toggleArchiveEntry,
  // types
  type DevSeries,
  type DevEntry,
  type DevEntryProgress,
} from "../../services/devotions";
import { buildDevotionHref } from "../../services/library";

/* ---------- helpers ---------- */
function coerceEntries(result: any): DevEntry[] {
  if (Array.isArray(result)) return result as DevEntry[];
  if (result && Array.isArray(result.data)) return result.data as DevEntry[];
  if (result && Array.isArray(result.entries)) return result.entries as DevEntry[];
  return [];
}
function pickSeriesId(x: any): string | null {
  if (!x) return null;
  if (typeof x === "string") return x;
  return x.series_id ?? x.id ?? x.series?.id ?? x?.data?.id ?? x?.data?.series_id ?? null;
}
function isTodayISO(isoYYYYMMDD?: string | null) {
  if (!isoYYYYMMDD) return false;
  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return isoYYYYMMDD === `${y}-${m}-${d}`;
}

/** Sidebar highlight shape (aggregated across entries) */
type SideHL = {
  id: string;
  entry_id: string;
  series_id: string;
  created_at: string;
  selected_text: string;
  color: "yellow" | "green" | "blue" | "pink" | "orange";
  visibility: "private" | "group" | "leaders";
  series_title?: string;
  entry_title?: string;
  day_index?: number;
};

/* ---------- page ---------- */
export default function DevotionsTabF180({ groupId }: { groupId: string }) {
  const [series, setSeries] = React.useState<DevSeries[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  const [query, setQuery] = React.useState("");
  const [openSeries, setOpenSeries] = React.useState<Set<string>>(new Set());
  const [entriesMap, setEntriesMap] = React.useState<Record<string, DevEntry[]>>({});
  const [busySeries, setBusySeries] = React.useState<string | null>(null);
  const [seriesErr, setSeriesErr] = React.useState<Record<string, string>>({});
  const [canEditMap, setCanEditMap] = React.useState<Record<string, boolean>>({});
  const [collabOpen, setCollabOpen] = React.useState<Record<string, boolean>>({});
  const [showGen, setShowGen] = React.useState(true); // sidebar open by default
  const [hideArchived, setHideArchived] = React.useState(true); // NEW
  const [archivedOpen, setArchivedOpen] = React.useState<Record<string, boolean>>({}); // NEW: per-series toggle

  // progress: seriesId -> (entryId -> progress)
  const [progressBySeries, setProgressBySeries] = React.useState<
    Record<string, Record<string, DevEntryProgress>>
  >({});

  // my user id (used to show only my entries)
  const [meId, setMeId] = React.useState<string | null>(null);

  // sidebar highlight aggregation
  const [sidebarHL, setSidebarHL] = React.useState<SideHL[]>([]);

  React.useEffect(() => {
    supabase.auth.getUser().then((u) => setMeId(u.data.user?.id ?? null));
  }, []);

  const reloadSeries = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const rows = await listSeriesForGroup(groupId);
      setSeries(rows || []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load devotions");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  React.useEffect(() => {
    if (groupId) reloadSeries();
  }, [groupId, reloadSeries]);

  const loadProgressForSeries = React.useCallback(async (sid: string) => {
    try {
      const map = await getMyProgressForSeries(sid);
      setProgressBySeries((prev) => ({ ...prev, [sid]: map }));
    } catch (e) {
      // silent — progress is optional UX
    }
  }, []);

  const toggleSeries = async (sid: string) => {
    const next = new Set(openSeries);
    const isOpen = next.has(sid);
    if (isOpen) {
      next.delete(sid);
      setOpenSeries(next);
      // when closing a series, remove its highlights from sidebar
      setSidebarHL((prev) => prev.filter((h) => h.series_id !== sid));
      return;
    }
    next.add(sid);
    setOpenSeries(next);

    if (!entriesMap[sid]) {
      setBusySeries(sid);
      setSeriesErr((m) => ({ ...m, [sid]: "" }));
      try {
        const raw = await listEntries(sid as any);
        const rows = coerceEntries(raw);
        setEntriesMap((m) => ({ ...m, [sid]: rows }));
      } catch (e: any) {
        setSeriesErr((m) => ({ ...m, [sid]: e?.message ?? "Failed to load entries" }));
      } finally {
        setBusySeries(null);
      }
    }

    if (progressBySeries[sid] === undefined) {
      loadProgressForSeries(sid);
    }

    if (canEditMap[sid] === undefined) {
      try {
        const caps = await mySeriesCapabilities(sid);
        setCanEditMap((m) => ({ ...m, [sid]: !!caps?.can_edit }));
      } catch {
        setCanEditMap((m) => ({ ...m, [sid]: false }));
      }
    }
  };

  const filtered = React.useMemo(() => {
    if (!query.trim()) return series;
    const q = query.toLowerCase();
    return series.filter((s) => {
      const hit = s.title?.toLowerCase().includes(q) || (s.description ?? "").toLowerCase().includes(q);
      if (hit) return true;
      const entries = entriesMap[s.id] || [];
      return entries.some(
        (en) => en.title?.toLowerCase().includes(q) || (en.body_md ?? "").toLowerCase().includes(q)
      );
    });
  }, [series, query, entriesMap]);

  /** Upsert highlights for an entry into the sidebar aggregation (sorted newest first) */
  const upsertSidebarHighlights = React.useCallback(
    (
      meta: { seriesId: string; seriesTitle?: string; entryId: string; entryTitle?: string; dayIndex?: number },
      list: Array<{ id: string; created_at: string; selected_text: string; color: SideHL["color"]; visibility: SideHL["visibility"] }>
    ) => {
      setSidebarHL((prev) => {
        const base = prev.filter((h) => h.entry_id !== meta.entryId);
        const add: SideHL[] = list.map((h) => ({
          id: h.id,
          entry_id: meta.entryId,
          series_id: meta.seriesId,
          created_at: h.created_at,
          selected_text: h.selected_text,
          color: h.color,
          visibility: h.visibility,
          series_title: meta.seriesTitle,
          entry_title: meta.entryTitle,
          day_index: meta.dayIndex,
        }));
        return [...add, ...base].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
    },
    []
  );

  // update a single entry progress cell in-place
  const mutateProgress = (sid: string, entryId: string, patch: Partial<DevEntryProgress>) => {
    setProgressBySeries((prev) => {
      const seriesMap = { ...(prev[sid] || {}) };
      const before = seriesMap[entryId] || {
        entry_id: entryId,
        series_id: sid,
        read_at: null,
        archived_at: null,
      };
      seriesMap[entryId] = { ...before, ...patch };
      return { ...prev, [sid]: seriesMap };
    });
  };

  return (
    <div className="mx-auto max-w-6xl">
      <style>{`
        .f180-dev :is(.bg-white,.bg-gray-50,.bg-slate-50) { background-color: hsl(var(--card)) !important; }
        .f180-dev :is(.border-gray-200,.border-slate-200) { border-color: hsl(var(--border)) !important; }
        .f180-dev mark { border-radius: .25rem; padding: 0 .2rem; }
      `}</style>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_340px] gap-4">
        {/* LEFT: main series/entries */}
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-transparent">
          <div className="sticky top-14 z-10 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/90 backdrop-blur px-3 py-2 rounded-t-2xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight">Devotions</h2>
                <span className="text-xs rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-0.5 text-[hsl(var(--muted-foreground))]">
                  {filtered.length} series
                </span>
                {loading && <span className="text-xs text-[hsl(var(--muted-foreground))]">Loading…</span>}
                {err && <span className="text-xs text-[hsl(var(--primary))]">{err}</span>}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs flex items-center gap-1">
                  <input
                    type="checkbox"
                    className="accent-current"
                    checked={hideArchived}
                    onChange={(e) => setHideArchived(e.target.checked)}
                  />
                  Hide archived
                </label>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search series or entries…"
                  className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-sm outline-none min-w-[220px]"
                />
                <button
                  type="button"
                  className="text-xs rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5"
                  onClick={() => setShowGen((v) => !v)}
                  title="Generate multi-day series with AI"
                >
                  {showGen ? "Hide generator" : "Generate series (AI)"}
                </button>
              </div>
            </div>
          </div>

          {loading && <div className="p-3 text-sm opacity-70">Loading…</div>}
          {err && (
            <div className="p-3 text-sm" style={{ color: "hsla(0,75%,60%,1)" }}>
              {err}
            </div>
          )}
          {!loading && !err && filtered.length === 0 && (
            <div className="p-4 text-sm opacity-80">No series match your search.</div>
          )}

          <ul className="p-2 space-y-2 f180-dev">
            {filtered.map((s) => {
              const open = openSeries.has(s.id);
              const entriesAll = entriesMap[s.id] || [];
              // only entries authored by me
              const meOnly = (en: any) => (en.author_id ?? en.created_by ?? en.owner_id) === meId;
              const entriesMine = meId ? entriesAll.filter(meOnly) : [];

              const sErr = seriesErr[s.id];
              const canEdit = !!canEditMap[s.id];
              const isCollabOpen = !!collabOpen[s.id];

              // progress for this series
              const pMap = progressBySeries[s.id] || {};
              const visibleEntries = hideArchived
                ? entriesMine.filter((en) => !pMap[String(en.id)]?.archived_at)
                : entriesMine;

              const archivedEntries = entriesMine.filter((en) => !!pMap[String(en.id)]?.archived_at);
              const isArchivedOpen = !!archivedOpen[s.id];

              return (
                <li key={s.id} className="rounded-xl border border-[hsl(var(--border))] bg-transparent p-3">
                  {/* header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{s.title}</div>
                      <div className="text-xs opacity-70">
                        {s.visibility === "group" ? "Group" : s.visibility === "leaders" ? "Leaders" : "Private"} •{" "}
                        {new Date(s.created_at).toLocaleDateString()}
                      </div>
                      {s.description && <div className="mt-1 text-sm opacity-90 line-clamp-2">{s.description}</div>}
                    </div>
                    <div className="flex items-center gap-3">
                      <button type="button" className="text-sm underline" onClick={() => toggleSeries(s.id)}>
                        {open ? "Hide entries" : "Show entries"}
                      </button>
                      <button
                        type="button"
                        className="text-sm underline"
                        onClick={() => setCollabOpen((m) => ({ ...m, [s.id]: !m[s.id] }))}
                      >
                        {isCollabOpen ? "Hide collaborators" : "Collaborators"}
                      </button>
                    </div>
                  </div>

                  {/* collaborators panel */}
                  {isCollabOpen && (
                    <div className="mt-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
                      <SeriesCollaboratorsPanel seriesId={s.id} />
                    </div>
                  )}

                  {/* entries */}
                  {open && (
                    <div className="mt-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                      {busySeries === s.id && <div className="p-3 text-sm opacity-70">Loading entries…</div>}
                      {sErr && (
                        <div className="p-3 text-sm" style={{ color: "hsla(0,75%,60%,1)" }}>
                          {sErr}
                        </div>
                      )}
                      {busySeries !== s.id && !sErr && entriesMine.length === 0 && (
                        <div className="p-3 text-sm opacity-70">
                          {entriesAll.length > 0
                            ? "No entries authored by you in this series."
                            : "No entries yet."}
                        </div>
                      )}
                      {busySeries !== s.id && !sErr && entriesMine.length > 0 && (
                        <>
                          {/* visible (non-archived or all) */}
                          <ul className="divide-y divide-[hsl(var(--border))]">
                            {visibleEntries.map((en) => (
                              <EntryItem
                                key={String(en.id)}
                                groupId={groupId}
                                seriesId={s.id}
                                seriesTitle={s.title}
                                en={en}
                                canEdit={canEdit}
                                progress={pMap[String(en.id)] || null}
                                onChanged={async () => {
                                  try {
                                    const raw = await listEntries(s.id as any);
                                    const rows = coerceEntries(raw);
                                    setEntriesMap((m) => ({ ...m, [s.id]: rows }));
                                  } catch {}
                                }}
                                onProgressChange={(patch) => mutateProgress(s.id, String(en.id), patch)}
                                onHighlightsChanged={(list) =>
                                  upsertSidebarHighlights(
                                    {
                                      seriesId: s.id,
                                      seriesTitle: s.title,
                                      entryId: String(en.id),
                                      entryTitle: en.title,
                                      dayIndex: en.day_index,
                                    },
                                    list
                                  )
                                }
                              />
                            ))}
                          </ul>

                          {/* collapsed archived section (only when hidden) */}
                          {hideArchived && archivedEntries.length > 0 && (
                            <div className="border-t border-[hsl(var(--border))]">
                              <button
                                type="button"
                                className="w-full text-left px-3 py-2 text-xs underline"
                                onClick={() =>
                                  setArchivedOpen((m) => ({ ...m, [s.id]: !m[s.id] }))
                                }
                              >
                                {isArchivedOpen ? "Hide" : "Show"} archived ({archivedEntries.length})
                              </button>
                              {isArchivedOpen && (
                                <ul className="divide-y divide-[hsl(var(--border))]">
                                  {archivedEntries.map((en) => (
                                    <EntryItem
                                      key={`arch-${String(en.id)}`}
                                      groupId={groupId}
                                      seriesId={s.id}
                                      seriesTitle={s.title}
                                      en={en}
                                      canEdit={canEdit}
                                      progress={pMap[String(en.id)] || null}
                                      onChanged={async () => {
                                        try {
                                          const raw = await listEntries(s.id as any);
                                          const rows = coerceEntries(raw);
                                          setEntriesMap((m) => ({ ...m, [s.id]: rows }));
                                        } catch {}
                                      }}
                                      onProgressChange={(patch) =>
                                        mutateProgress(s.id, String(en.id), patch)
                                      }
                                      onHighlightsChanged={(list) =>
                                        upsertSidebarHighlights(
                                          {
                                            seriesId: s.id,
                                            seriesTitle: s.title,
                                            entryId: String(en.id),
                                            entryTitle: en.title,
                                            dayIndex: en.day_index,
                                          },
                                          list
                                        )
                                      }
                                    />
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* RIGHT: sidebar – generator + highlights */}
        <aside className="md:sticky md:top-14 space-y-4">
          {showGen && (
            <GenerateSeriesCard
              groupId={groupId}
              seriesOptions={series}
              onInserted={async (targetSeriesId) => {
                await reloadSeries();
                const sid = targetSeriesId || null;
                if (sid) {
                  const next = new Set(openSeries);
                  next.add(sid);
                  setOpenSeries(next);
                  try {
                    const raw = await listEntries(sid as any);
                    const rows = coerceEntries(raw);
                    setEntriesMap((m) => ({ ...m, [sid]: rows }));
                    await loadProgressForSeries(sid);
                  } catch {}
                }
              }}
            />
          )}

          <HighlightsSidebar
            groupId={groupId}
            items={sidebarHL}
            onClear={() => setSidebarHL([])}
          />
        </aside>
      </div>
    </div>
  );
}

/* ---------- Generate series (AI) card (sidebar) ---------- */
function GenerateSeriesCard({
  groupId,
  seriesOptions,
  onInserted,
}: {
  groupId: string;
  seriesOptions: DevSeries[];
  onInserted: (seriesId?: string) => void;
}) {
  // Step A — ask for drafts
  const [theme, setTheme] = React.useState("");
  const [days, setDays] = React.useState<number>(7);
  const [notes, setNotes] = React.useState("");

  // Step B — drafts preview
  type Draft = { title?: string; body?: string; body_md?: string; day_index?: number };
  const [drafts, setDrafts] = React.useState<Draft[]>([]);
  const [suggestedTitle, setSuggestedTitle] = React.useState("");
  const [suggestedDesc, setSuggestedDesc] = React.useState("");

  // Step C — target + insert options
  const [createNew, setCreateNew] = React.useState(true);
  const [targetSeriesId, setTargetSeriesId] = React.useState<string>("");
  const [newTitle, setNewTitle] = React.useState("");
  const [visibility, setVisibility] = React.useState<"group" | "leaders" | "private">("group");
  const [newDesc, setNewDesc] = React.useState("");
  const [startDate, setStartDate] = React.useState<string>("");
  const [cadence, setCadence] = React.useState<"daily" | "weekly">("daily");

  const isValidStart = React.useMemo(
    () => !!startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate),
    [startDate]
  );
  const safeStartForHint = isValidStart ? startDate : null;

  // UX
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const canGenerate = theme.trim().length > 0 && days >= 1 && !busy;

  /** Normalize various response shapes into {drafts, title, description}. */
  function parseDrafts(payload: any): { drafts: Draft[]; title?: string; description?: string } {
    const norm = (arr: any[]): Draft[] =>
      (arr || []).map((d, i) => ({
        title: d?.title ?? d?.heading ?? `Day ${d?.day_index ?? i + 1}`,
        body_md: d?.body_md ?? d?.body ?? d?.content ?? "",
        day_index: d?.day_index ?? i + 1,
      }));

    const roots = [payload, payload?.data, payload?.result];
    for (const r of roots) {
      if (!r) continue;
      if (Array.isArray(r)) return { drafts: norm(r), title: payload?.title, description: payload?.description };
      if (Array.isArray(r?.drafts)) return { drafts: norm(r.drafts), title: r?.title ?? payload?.title, description: r?.description ?? payload?.description };
      if (Array.isArray(r?.entries)) return { drafts: norm(r.entries), title: r?.title ?? payload?.title, description: r?.description ?? payload?.description };
      if (Array.isArray(r?.items)) return { drafts: norm(r.items), title: r?.title ?? payload?.title, description: r?.description ?? payload?.description };
    }
    return { drafts: [], title: payload?.title, description: payload?.description };
  }

  /** Try Edge Functions first (two common names), then fall back to the service. */
  async function generateDraftsCompat(themeIn: string, daysIn: number, notesIn?: string) {
    const names = ["generate-devotion-series", "devotion-generate-series"];
    let best: { drafts: Draft[]; title?: string; description?: string } = { drafts: [] };

    for (const name of names) {
      try {
        const { data, error } = await supabase.functions.invoke(name, {
          body: { theme: themeIn, days: daysIn, notes: notesIn || undefined },
        });
        if (error) throw error;
        const parsed = parseDrafts(data);
        if (parsed.drafts.length > 0) return parsed;
        best = parsed;
      } catch (e) {
        console.warn("[GEN] Edge call failed for", name, e);
      }
    }

    try {
      const res: any = await (generateDevotionSeries as any)(themeIn, daysIn, notesIn || undefined);
      const parsed = parseDrafts(res);
      if (parsed.drafts.length > 0) return parsed;
      return best.drafts.length > 0 ? best : parsed;
    } catch (e) {
      console.warn("[GEN] Service call failed:", e);
      return best;
    }
  }

  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Generate multi-day series (AI)</div>
        <div className="text-[11px] opacity-60">Drafts → insert → series</div>
      </div>

      {/* Step A — Ask AI for drafts */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="text-xs opacity-70">Theme / prompt</label>
          <input
            className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1.5 text-sm"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="e.g., Healing from brokenness; men’s fellowship tone; anchor on James 1"
          />
        </div>
        <div>
          <label className="text-xs opacity-70">Days</label>
          <input
            type="number"
            min={1}
            className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1.5 text-sm"
            value={days}
            onChange={(e) => setDays(Math.max(1, parseInt(e.target.value || "1", 10)))}
          />
        </div>

        <div className="sm:col-span-3">
          <label className="text-xs opacity-70">Notes to the writer (optional)</label>
          <input
            className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1.5 text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Tone, key verses to anchor, audience details, etc."
          />
        </div>

        <div className="sm:col-span-3">
          <button
            type="button"
            className="rounded-xl bg-[hsl(var(--primary))] px-3 py-1.5 text-sm font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-60"
            disabled={!canGenerate}
            onClick={async () => {
              const canGenerateNow = theme.trim().length > 0 && days >= 1;
              if (!canGenerateNow) return;
              setBusy(true);
              setMsg(null);
              setErr(null);
              setDrafts([]);
              try {
                const res = await generateDraftsCompat(theme.trim(), days, notes.trim() || undefined);
                const draftsArr = res.drafts || [];
                setDrafts(draftsArr);
                setSuggestedTitle(res.title || "");
                setSuggestedDesc(res.description || "");
                setNewTitle(res.title || `Devotions: ${theme.trim()}`);
                setNewDesc(res.description || "");
                setMsg(`Generated ${draftsArr.length} drafts.`);
              } catch (e: any) {
                setErr(e?.message ?? "Failed to generate drafts");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Generating…" : "Generate drafts"}
          </button>
          {msg && <span className="ml-2 text-xs opacity-80">{msg}</span>}
          {err && <span className="ml-2 text-xs" style={{ color: "hsla(0,75%,60%,1)" }}>{err}</span>}
        </div>
      </div>

      {/* Step B — Preview drafts */}
      {drafts.length > 0 && (
        <div className="mt-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Drafts preview</div>
            <div className="text-xs opacity-70">{drafts.length} items</div>
          </div>
          <ul className="mt-2 space-y-2 max-h-72 overflow-auto">
            {drafts.map((d, i) => (
              <li key={i} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-2">
                <div className="text-sm font-medium">
                  Day {d.day_index ?? i + 1}: {d.title || `Day ${d.day_index ?? i + 1}`}
                </div>
                <div className="mt-1 text-sm whitespace-pre-wrap opacity-90">
                  {(d.body_md ?? d.body ?? "").slice(0, 500)}
                  {(d.body_md ?? d.body ?? "").length > 500 ? "…" : ""}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Step C — Insert into series */}
      {drafts.length > 0 && (
        <InsertDraftsCard
          groupId={groupId}
          seriesOptions={seriesOptions}
          drafts={drafts}
          suggestedTitle={suggestedTitle}
          suggestedDesc={suggestedDesc}
          createNew={createNew}
          setCreateNew={setCreateNew}
          targetSeriesId={targetSeriesId}
          setTargetSeriesId={setTargetSeriesId}
          newTitle={newTitle}
          setNewTitle={setNewTitle}
          visibility={visibility}
          setVisibility={setVisibility}
          newDesc={newDesc}
          setNewDesc={setNewDesc}
          startDate={startDate}
          setStartDate={setStartDate}
          cadence={cadence}
          setCadence={setCadence}
          busy={busy}
          setBusy={setBusy}
          msg={msg}
          setMsg={setMsg}
          err={err}
          setErr={setErr}
          onInserted={onInserted}
        />
      )}
    </div>
  );
}

function InsertDraftsCard(props: {
  groupId: string;
  seriesOptions: DevSeries[];
  drafts: Array<{ title?: string; body?: string; body_md?: string; day_index?: number }>;
  suggestedTitle: string;
  suggestedDesc: string;
  createNew: boolean;
  setCreateNew: (v: boolean) => void;
  targetSeriesId: string;
  setTargetSeriesId: (v: string) => void;
  newTitle: string;
  setNewTitle: (v: string) => void;
  visibility: "group" | "leaders" | "private";
  setVisibility: (v: "group" | "leaders" | "private") => void;
  newDesc: string;
  setNewDesc: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  cadence: "daily" | "weekly";
  setCadence: (v: "daily" | "weekly") => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
  msg: string | null;
  setMsg: (v: string | null) => void;
  err: string | null;
  setErr: (v: string | null) => void;
  onInserted: (seriesId?: string) => void;
}) {
  const {
    groupId, seriesOptions, drafts, suggestedTitle, suggestedDesc,
    createNew, setCreateNew, targetSeriesId, setTargetSeriesId,
    newTitle, setNewTitle, visibility, setVisibility, newDesc, setNewDesc,
    startDate, setStartDate, cadence, setCadence,
    busy, setBusy, msg, setMsg, err, setErr, onInserted
  } = props;

  const isValidStart = !!startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate);
  const safeStartForHint = isValidStart ? startDate : null;

  return (
    <div className="mt-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
      <div className="text-sm font-medium mb-2">Insert drafts</div>

      <div className="mb-2 flex items-center gap-3">
        <label className="text-xs flex items-center gap-1">
          <input type="radio" className="accent-current" checked={createNew} onChange={() => setCreateNew(true)} />
          Create new series
        </label>
        <label className="text-xs flex items-center gap-1">
          <input type="radio" className="accent-current" checked={!createNew} onChange={() => setCreateNew(false)} />
          Use existing series
        </label>
      </div>

      {createNew ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs opacity-70">New series title</label>
            <input
              className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1.5 text-sm"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs opacity-70">Visibility</label>
            <select
              className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1.5 text-sm"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as any)}
            >
              <option value="group">Group</option>
              <option value="leaders">Leaders</option>
              <option value="private">Private</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className="text-xs opacity-70">Description (optional)</label>
            <textarea
              rows={2}
              className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1.5 text-sm"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Short description for the series"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs opacity-70">Target series</label>
            <select
              className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1.5 text-sm"
              value={targetSeriesId}
              onChange={(e) => setTargetSeriesId(e.target.value)}
            >
              <option value="">Select…</option>
              {seriesOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} {s.visibility !== "group" ? `• ${s.visibility}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Start date + cadence row (gap-4) */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="text-xs opacity-70">Start date (optional)</label>
          <input
            type="date"
            className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1.5 text-sm"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs opacity-70">Cadence</label>
          <select
            className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1.5 text-sm"
            value={cadence}
            onChange={(e) => setCadence(e.target.value as any)}
          >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          </select>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          className="rounded-xl bg-[hsl(var(--primary))] px-3 py-1.5 text-sm font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-60"
          disabled={
            drafts.length === 0 ||
            (!createNew && !targetSeriesId) ||
            (createNew && !newTitle.trim())
          }
          onClick={async () => {
            const draftsArr = drafts;
            props.setBusy(true);
            props.setMsg(null);
            props.setErr(null);
            try {
              const mapped = draftsArr.map((d, i) => ({
                title: d.title || `Day ${d.day_index ?? i + 1}`,
                body_md: d.body_md ?? d.body ?? "",
                day_index: d.day_index ?? i + 1,
              }));

              async function resolveCreatedSeriesIdFallback(groupId: string, title: string) {
                const { data: userData } = await supabase.auth.getUser();
                const me = userData?.user?.id || null;
                const all = await listSeriesForGroup(groupId);
                const rows = Array.isArray(all) ? all : (all as any)?.data || [];

                const exactByMe = rows
                  .filter(
                    (s: any) =>
                      (s.title || "").trim() === title.trim() &&
                      (!!me && (s.owner_id === me || s.created_by === me || s.creator_id === me))
                  )
                  .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                if (exactByMe[0]?.id) return exactByMe[0].id;

                const exact = rows
                  .filter((s: any) => (s.title || "").trim() === title.trim())
                  .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                if (exact[0]?.id) return exact[0]?.id;

                const newest = rows.sort(
                  (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                )[0];
                return newest?.id ?? null;
              }

              let sid = targetSeriesId;

              if (createNew) {
                const created: any = await (createSeries as any)(
                  groupId,
                  newTitle.trim(),
                  visibility,
                  newDesc.trim() || undefined,
                  undefined
                );

                sid =
                  (created && (created.series_id || created.id)) ||
                  (created?.data && (created.data.series_id || created.data.id)) ||
                  (created?.series && (created.series.id || created.series.series_id)) ||
                  null;

                if (!sid) {
                  console.warn("[GEN] createSeries returned no id; resolving via lookup…", created);
                  sid = await resolveCreatedSeriesIdFallback(groupId, newTitle.trim());
                }
                if (!sid) throw new Error("Series was created but id couldn't be resolved.");
              }

              const isValidStart = !!startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate);
              const safeStart = isValidStart ? startDate : null;
              console.log("[Insert]", { sid, safeStart, cadence, count: mapped.length });

              const result = await (bulkAddEntries as any)(sid, safeStart, mapped, cadence);
              console.log("[Insert result]", result);

              props.setMsg(
                `Inserted ${
                  typeof result === "number" ? result : draftsArr.length
                } ${draftsArr.length === 1 ? "entry" : "entries"}.`
              );
              props.setTargetSeriesId("");
              props.setNewTitle(suggestedTitle || "");
              props.setNewDesc(suggestedDesc || "");
              props.onInserted?.(sid);
            } catch (e: any) {
              console.error("[Insert error]", e);
              props.setErr(
                e?.message ??
                  e?.error?.message ??
                  e?.data?.message ??
                  (typeof e === "string" ? e : "Failed to insert drafts")
              );
            } finally {
              props.setBusy(false);
            }
          }}
        >
          {busy ? "Inserting…" : `Insert ${drafts.length} ${drafts.length === 1 ? "entry" : "entries"}`}
        </button>
        {msg && <span className="text-xs opacity-80">{msg}</span>}
        {err && <span className="text-xs" style={{ color: "hsla(0,75%,60%,1)" }}>{err}</span>}
      </div>

      <div className="mt-2 text-[11px] opacity-60">
        Entries will be added {cadence === "daily" ? "every day" : "once a week"} starting
        {safeStartForHint ? ` ${safeStartForHint}` : " the day you add them"}.
      </div>
    </div>
  );
}

/* ---------- Highlights Sidebar ---------- */
function HighlightsSidebar({
  groupId,
  items,
  onClear,
}: {
  groupId: string;
  items: SideHL[];
  onClear: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Highlights</div>
        <button
          type="button"
          className="text-xs underline opacity-80 disabled:opacity-40"
          onClick={onClear}
          disabled={items.length === 0}
        >
          Clear
        </button>
      </div>
      {items.length === 0 ? (
        <div className="mt-2 text-sm opacity-70">No highlights yet. Open a series and add some.</div>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((h) => (
            <li key={h.id} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2">
              <div className="flex items-start gap-2">
                <span
                  className={`mt-1 inline-block h-3 w-3 rounded ${
                    h.color === "green" ? "bg-green-400" :
                    h.color === "blue"  ? "bg-blue-400"  :
                    h.color === "pink"  ? "bg-pink-400"  :
                    h.color === "orange"? "bg-orange-400": "bg-yellow-400"
                  }`}
                  title={h.color}
                />
                <div className="min-w-0">
                  <div className="text-xs opacity-60">
                    {(h.series_title || "Series")} • Day {h.day_index ?? "?"}
                    {h.entry_title ? ` • ${h.entry_title}` : ""} • <span className="uppercase">{h.visibility}</span>
                  </div>
                  <div className="mt-1 text-sm">“{h.selected_text}”</div>
                  <div className="mt-1">
                    <a
                      className="text-xs underline"
                      href={buildDevotionHref(groupId, h.series_id, h.entry_id)}
                      onClick={(e) => {
                        e.preventDefault();
                        window.location.hash = buildDevotionHref(groupId, h.series_id, h.entry_id);
                      }}
                    >
                      Open entry
                    </a>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- collaborators panel ---------- */
function SeriesCollaboratorsPanel({ seriesId }: { seriesId: string }) {
  const [caps, setCaps] = React.useState<{ can_edit: boolean }>({ can_edit: false });
  const [collab, setCollab] = React.useState<
    Array<{ user_id: string; role: "editor" | "viewer"; display_name: string | null; email: string | null }>
  >([]);
  const [invites, setInvites] = React.useState<
    Array<{
      id: string;
      token: string;
      role: "editor" | "viewer";
      email_lock: string | null;
      max_uses: number | null;
      used_count: number | null;
      expires_at: string | null;
      revoked_at: string | null;
      created_at: string;
    }>
  >([]);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const [role, setRole] = React.useState<"editor" | "viewer">("viewer");
  const [email, setEmail] = React.useState("");

  const load = async () => {
    setBusy(true);
    setErr(null);
    try {
      const [c, i, m] = await Promise.all([listCollaborators(seriesId), listInvites(seriesId), mySeriesCapabilities(seriesId)]);
      setCollab(c || []);
      setInvites(i || []);
      setCaps(m || { can_edit: false });
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load collaborators");
    } finally {
      setBusy(false);
    }
  };

  React.useEffect(() => {
    load();
  }, [seriesId]);

  const copy = async (txt: string) => {
    try {
      await navigator.clipboard.writeText(txt);
      console.log("Copied:", txt);
    } catch {
      alert("Couldn’t copy");
    }
  };
  const inviteHref = (token: string) => `${location.origin}/#/accept-devotion-invite?token=${encodeURIComponent(token)}`;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">Collaborators</div>
        <button type="button" className="text-xs underline" onClick={load} disabled={busy}>
          Refresh
        </button>
      </div>
      {err && <div className="mt-2 text-sm" style={{ color: "hsla(0,75%,60%,1)" }}>{err}</div>}

      {/* current collaborators */}
      <div className="mt-2">
        <div className="text-xs opacity-70 mb-1">Current</div>
        {collab.length === 0 ? (
          <div className="text-xs opacity-70">No collaborators yet.</div>
        ) : (
          <ul className="space-y-1">
            {collab.map((c) => (
              <li key={c.user_id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm">{c.display_name || c.email || c.user_id}</div>
                  <div className="text-[11px] opacity-60">{c.email}</div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <span className="text-[10px] rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-0.5 uppercase tracking-wide">
                    {c.role}
                  </span>
                  {caps.can_edit && (
                    <button
                      type="button"
                      className="text-xs underline opacity-80"
                      onClick={async () => {
                        try {
                          await removeCollaboratorByUser(seriesId, c.user_id);
                          await load();
                        } catch (e: any) {
                          alert(e?.message ?? "Failed to remove");
                        }
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* active invites */}
      <div className="mt-4">
        <div className="text-xs opacity-70 mb-1">Active invites</div>
        {invites.length === 0 ? (
          <div className="text-xs opacity-70">No active invites.</div>
        ) : (
          <ul className="space-y-1">
            {invites.map((iv) => (
              <li key={iv.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm">{iv.email_lock ? `${iv.email_lock} (locked)` : "Open"} • {iv.role}</div>
                  <div className="text-[11px] opacity-60">
                    Created {new Date(iv.created_at).toLocaleString()}
                    {iv.expires_at ? ` • Expires ${new Date(iv.expires_at).toLocaleDateString()}` : ""}
                    {iv.revoked_at ? ` • Revoked` : ""}
                    {iv.max_uses ? ` • Uses {${iv.used_count ?? 0}}/${iv.max_uses}` : ""}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <button
                    type="button"
                    className="text-xs rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-0.5"
                    onClick={() => copy(inviteHref(iv.token))}
                  >
                    Copy link
                  </button>
                  {caps.can_edit && !iv.revoked_at && (
                    <button
                      type="button"
                      className="text-xs underline opacity-80"
                      onClick={async () => {
                        try {
                          await revokeInvite(iv.id);
                          await load();
                        } catch (e: any) {
                          alert(e?.message ?? "Failed to revoke");
                        }
                      }}
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* create invite */}
      {caps.can_edit && (
        <div className="mt-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-2">
          <div className="text-sm font-medium mb-2">Create invite link</div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "editor" | "viewer")}
              className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1 text-xs outline-none"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Lock to email (optional)"
              className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1 text-sm outline-none"
            />
            <button
              type="button"
              className="rounded-xl bg-[hsl(var(--primary))] px-3 py-1.5 text-sm font-medium text-[hsl(var(--primary-foreground))]"
              onClick={async () => {
                try {
                  const res = await createInviteLinkSimple(seriesId, role, email.trim() || undefined);
                  const token = (res as any)?.token ?? (typeof res === "string" ? res : "");
                  if (!token) throw new Error("No token returned");
                  await load();
                  await navigator.clipboard.writeText(`${location.origin}/#/accept-devotion-invite?token=${encodeURIComponent(token)}`);
                } catch (e: any) {
                  alert(e?.message ?? "Failed to create invite");
                }
              }}
            >
              Create link
            </button>
          </div>
          <div className="mt-1 text-[11px] opacity-60">New invite is copied automatically. Share it with collaborators.</div>
        </div>
      )}
    </div>
  );
}

/* ---------- entry item (read + archive + sentence-highlighting) ---------- */
type DevHighlight = {
  id: string;
  user_id: string;
  start_pos: number;
  length: number;
  selected_text: string;
  color: "yellow" | "green" | "blue" | "pink" | "orange";
  visibility: "private" | "group" | "leaders";
  note: string | null;
  created_at: string;
};

function EntryItem({
  groupId,
  seriesId,
  seriesTitle,
  en,
  canEdit,
  progress,
  onChanged,
  onProgressChange,
  onHighlightsChanged,
}: {
  groupId: string;
  seriesId: string;
  seriesTitle: string;
  en: DevEntry;
  canEdit: boolean;
  progress: DevEntryProgress | null;
  onChanged: () => void;
  onProgressChange: (patch: Partial<DevEntryProgress>) => void;
  onHighlightsChanged?: (list: Array<Pick<DevHighlight, "id" | "created_at" | "selected_text" | "color" | "visibility">>) => void;
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [eDay, setEDay] = React.useState<number>(en.day_index);
  const [eTitle, setETitle] = React.useState(en.title);
  const [eBody, setEBody] = React.useState(en.body_md ?? "");
  const [eStatus, setEStatus] = React.useState<"draft" | "scheduled" | "published">(
    (["draft", "scheduled", "published"] as const).includes(en.status as any) ? (en.status as any) : "draft"
  );
  const [eDate, setEDate] = React.useState<string>(en.scheduled_date ?? "");
  const [savingEntry, setSavingEntry] = React.useState(false);
  const [deletingEntry, setDeletingEntry] = React.useState(false);

  React.useEffect(() => {
    setEDay(en.day_index);
    setETitle(en.title);
    setEBody(en.body_md ?? "");
    setEStatus(
      (["draft", "scheduled", "published"] as const).includes(en.status as any) ? (en.status as any) : "draft"
    );
    setEDate(en.scheduled_date ?? "");
  }, [en.id]);

  // chips
  const today = isTodayISO(en.scheduled_date || null);
  const read = !!progress?.read_at;
  const archived = !!progress?.archived_at;

  // highlights
  const [highlights, setHighlights] = React.useState<DevHighlight[]>([]);
  const [loadingHL, setLoadingHL] = React.useState(false);
  const [me, setMe] = React.useState<string | null>(null);
  const [deletingHLId, setDeletingHLId] = React.useState<string | null>(null);

  // click-to-highlight state
  const body = eBody;
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const [selOpen, setSelOpen] = React.useState(false);
  const [selStart, setSelStart] = React.useState<number | null>(null);
  const [selLen, setSelLen] = React.useState(0);
  const [selText, setSelText] = React.useState("");
  const [vis, setVis] = React.useState<"private" | "group" | "leaders">("private");
  const [color, setColor] = React.useState<"yellow" | "green" | "blue" | "pink" | "orange">("yellow");
  const [note, setNote] = React.useState("");

  const clearSelectionPanel = () => {
    setSelOpen(false);
    setSelStart(null);
    setSelLen(0);
    setSelText("");
    setNote("");
  };

  // Observe visibility to auto-mark read
  const rootRef = React.useRef<HTMLLIElement>(null);
  React.useEffect(() => {
    if (read) return; // already read
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const ent of entries) {
          if (ent.isIntersecting && ent.intersectionRatio >= 0.6) {
            // mark read once
            markEntryRead(seriesId, String(en.id))
              .then(() => onProgressChange({ entry_id: String(en.id), series_id: seriesId, read_at: new Date().toISOString() }))
              .catch(() => {});
            io.disconnect();
            break;
          }
        }
      },
      { threshold: [0.6] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [read, seriesId, en.id, onProgressChange]);

  // fallback: manual text selection
  const onBodyMouseUp = () => {
    const container = bodyRef.current;
    if (!container) return;
    const sel = window.getSelection?.();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
      return;
    }
    const pre = range.cloneRange();
    pre.selectNodeContents(container);
    pre.setEnd(range.startContainer, range.startOffset);
    const start = pre.toString().length;
    const text = sel.toString();
    const len = text.length;
    if (len <= 0) return;
    setSelStart(start);
    setSelLen(len);
    setSelText(text);
    setSelOpen(true);
  };

  // split body into sentence spans with offsets
  const sentences = React.useMemo(() => {
    const arr: Array<{ start: number; end: number }> = [];
    const n = body.length;
    let start = 0;
    for (let i = 0; i < n; i++) {
      const ch = body[i];
      if (ch === "." || ch === "!" || ch === "?") {
        const end = i + 1;
        arr.push({ start, end });
        start = end;
      }
    }
    if (start < n) arr.push({ start, end: n });
    return arr.filter((r) => r.end > r.start);
  }, [body]);

  function renderSentenceWithHighlights(seg: { start: number; end: number }, idxKey: number) {
    const within = [...highlights]
      .filter((h) => {
        const hs = h.start_pos;
        const he = h.start_pos + h.length;
        return he > seg.start && hs < seg.end;
      })
      .sort((a, b) => a.start_pos - b.start_pos);

    const nodes: React.ReactNode[] = [];
    let cursor = seg.start;
    const colorClass = (c: DevHighlight["color"]) =>
      c === "green" ? "bg-green-200" :
      c === "blue"  ? "bg-blue-200"  :
      c === "pink"  ? "bg-pink-200"  :
      c === "orange"? "bg-orange-200": "bg-yellow-200";

    for (const h of within) {
      const hs = Math.max(seg.start, h.start_pos);
      const he = Math.min(seg.end, h.start_pos + h.length);
      if (he <= cursor) continue;
      if (hs > cursor) {
        nodes.push(<span key={`s-${idxKey}-${cursor}`}>{body.slice(cursor, hs)}</span>);
      }
      nodes.push(
        <mark
          key={`h-${h.id}`}
          className={`rounded px-0.5 ${colorClass(h.color)}`}
          title={`${h.visibility}${h.note ? ` • ${h.note}` : ""}`}
        >
          {body.slice(hs, he)}
        </mark>
      );
      cursor = he;
    }
    if (cursor < seg.end) {
      nodes.push(<span key={`tail-${idxKey}`}>{body.slice(cursor, seg.end)}</span>);
    }

    const onClickSentence = () => {
      let s = seg.start;
      let e = seg.end;
      while (s < e && /\s/.test(body[s])) s++;
      while (e > s && /\s/.test(body[e - 1])) e--;
      if (e <= s) return;
      setSelStart(s);
      setSelLen(e - s);
      setSelText(body.slice(s, e));
      setSelOpen(true);
      const sel = window.getSelection?.();
      if (sel && sel.removeAllRanges) sel.removeAllRanges();
    };

    return (
      <span
        key={`seg-${idxKey}-${seg.start}`}
        className="cursor-pointer hover:bg-[hsla(0,80%,45%,0.12)] rounded-sm"
        onClick={onClickSentence}
      >
        {nodes}
      </span>
    );
  }

  const loadHL = async () => {
    setLoadingHL(true);
    try {
      const rows = await listEntryHighlights(en.id as any);
      setHighlights(rows as any);
      onHighlightsChanged?.(
        (rows as any[]).map((r) => ({
          id: r.id,
          created_at: r.created_at,
          selected_text: r.selected_text,
          color: r.color,
          visibility: r.visibility,
        }))
      );
    } catch (e: any) {
      console.warn(e?.message);
    } finally {
      setLoadingHL(false);
    }
  };

  React.useEffect(() => {
    loadHL();
    supabase.auth.getUser().then((u) => setMe(u.data.user?.id ?? null));
  }, [en.id]);

  const saveEntry = async () => {
    if (savingEntry) return;
    setSavingEntry(true);
    try {
      await updateEntry(en.id as any, {
        day_index: eDay,
        title: eTitle,
        body_md: eBody,
        status: eStatus,
        scheduled_date: eDate || null,
      } as any);
      setIsEditing(false);
      await onChanged();
    } catch (e: any) {
      alert(e?.message ?? "Failed to update entry");
    } finally {
      setSavingEntry(false);
    }
  };

  const removeEntry = async () => {
    if (!confirm("Delete this entry?")) return;
    setDeletingEntry(true);
    try {
      await deleteEntry(en.id as any);
      await onChanged();
    } catch (e: any) {
      alert(e?.message ?? "Failed to delete entry");
    } finally {
      setDeletingEntry(false);
    }
  };

  // small ephemeral message when archiving
  const [archMsg, setArchMsg] = React.useState<string | null>(null);
  const doArchive = async (to: boolean) => {
    try {
      await toggleArchiveEntry(seriesId, String(en.id), to);
      onProgressChange({ entry_id: String(en.id), series_id: seriesId, archived_at: to ? new Date().toISOString() : null });
      setArchMsg(to ? "Archived" : "Unarchived");
      setTimeout(() => setArchMsg(null), 2000);
    } catch (e: any) {
      alert(e?.message ?? "Failed to update archive state");
    }
  };

  return (
    <li ref={rootRef} className="p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">
            Day {en.day_index}: {eTitle || `Day ${en.day_index}`}
          </div>
          <div className="text-xs opacity-70">
            {en.status}
            {en.scheduled_date ? ` • ${en.scheduled_date}` : ""}
          </div>

          {/* chips */}
          <div className="mt-1 flex flex-wrap gap-1">
            {today && (
              <span className="text-[10px] uppercase tracking-wide rounded-full border border-[hsl(var(--border))] bg-[hsla(0,100%,50%,0.12)] px-2 py-0.5">
                Today
              </span>
            )}
            {read && (
              <span className="text-[10px] uppercase tracking-wide rounded-full border border-[hsl(var(--border))] bg-[hsla(120,70%,40%,0.12)] px-2 py-0.5">
                Read
              </span>
            )}
            {archived && (
              <span className="text-[10px] uppercase tracking-wide rounded-full border border-[hsl(var(--border))] bg-[hsla(0,0%,100%,0.06)] px-2 py-0.5">
                Archived
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            className="text-sm underline"
            href={buildDevotionHref(groupId, seriesId, en.id as any)}
            onClick={(e) => {
              e.preventDefault();
              // mark read on explicit open
              if (!read) {
                markEntryRead(seriesId, String(en.id))
                  .then(() => onProgressChange({ entry_id: String(en.id), series_id: seriesId, read_at: new Date().toISOString() }))
                  .catch(() => {});
              }
              window.location.hash = buildDevotionHref(groupId, seriesId, en.id as any);
            }}
          >
            Open
          </a>

          {/* archive actions */}
          {read && !archived && (
            <button
              type="button"
              className="text-sm underline opacity-90"
              onClick={() => doArchive(true)}
              title="Archive this entry"
            >
              Archive
            </button>
          )}
          {archived && (
            <button
              type="button"
              className="text-sm underline opacity-90"
              onClick={() => doArchive(false)}
              title="Unarchive this entry"
            >
              Unarchive
            </button>
          )}

          {canEdit && (
            <>
              <button type="button" className="text-sm underline" onClick={() => setIsEditing((v) => !v)}>
                {isEditing ? "Cancel" : "Edit"}
              </button>
              <button
                type="button"
                className="text-sm underline text-red-500 disabled:opacity-50"
                onClick={removeEntry}
                disabled={deletingEntry}
              >
                {deletingEntry ? "Deleting…" : "Delete"}
              </button>
            </>
          )}
        </div>
      </div>

      {archMsg && <div className="mt-1 text-xs opacity-80">{archMsg}</div>}

      {/* body (CLICK-A-SENTENCE; manual selection still works as fallback) */}
      {isEditing ? (
        <div className="mt-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div>
              <label className="text-xs opacity-70">Day</label>
              <input
                type="number"
                className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1 text-sm"
                value={eDay}
                onChange={(e) => setEDay(parseInt(e.target.value || "0", 10))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs opacity-70">Title</label>
              <input
                className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1 text-sm"
                value={eTitle}
                onChange={(e) => setETitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs opacity-70">Status</label>
              <select
                className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1 text-sm"
                value={eStatus}
                onChange={(e) => setEStatus(e.target.value as any)}
              >
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div className="sm:col-span-4">
              <label className="text-xs opacity-70">Scheduled date (optional)</label>
              <input
                type="date"
                className="mt-1 w-full max-w-xs rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1 text-sm"
                value={eDate}
                onChange={(e) => setEDate(e.target.value)}
              />
            </div>
            <div className="sm:col-span-4">
              <label className="text-xs opacity-70">Body</label>
              <textarea
                rows={8}
                className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1 text-sm"
                value={eBody}
                onChange={(e) => setEBody(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              className="rounded-xl bg-[hsl(var(--primary))] px-3 py-1.5 text-sm font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-60"
              onClick={saveEntry}
              disabled={savingEntry}
            >
              {savingEntry ? "Saving…" : "Save changes"}
            </button>
            <button type="button" className="text-sm underline" onClick={() => setIsEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            ref={bodyRef}
            onMouseUp={onBodyMouseUp}
            className="mt-2 text-sm whitespace-pre-wrap"
          >
            {sentences.map((seg, i) => renderSentenceWithHighlights(seg, i))}
          </div>

          {/* inline selection bar */}
          {selOpen && (
            <div className="mt-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
              <div className="text-xs opacity-70">Selected</div>
              <div className="mt-1 text-sm italic">“{selText}”</div>

              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-xs opacity-70">Visibility</label>
                  <select
                    className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1 text-sm"
                    value={vis}
                    onChange={(e) => setVis(e.target.value as any)}
                  >
                    <option value="private">Private</option>
                    <option value="group">Group</option>
                    <option value="leaders">Leaders</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs opacity-70">Color</label>
                  <select
                    className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1 text-sm"
                    value={color}
                    onChange={(e) => setColor(e.target.value as any)}
                  >
                    <option value="yellow">Yellow</option>
                    <option value="green">Green</option>
                    <option value="blue">Blue</option>
                    <option value="pink">Pink</option>
                    <option value="orange">Orange</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs opacity-70">Note (optional)</label>
                  <input
                    className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1 text-sm"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Why this stood out…"
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-[hsl(var(--primary))] px-3 py-1.5 text-sm font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-60"
                  onClick={async () => {
                    try {
                      if ((selStart ?? 0) < 0 || selLen <= 0 || !selText.trim()) {
                        alert("Select some text first.");
                        return;
                      }
                      await createEntryHighlight(en.id as any, selStart as number, selLen, selText, {
                        visibility: vis,
                        color,
                        note: note.trim() || null,
                        bodyHash: null,
                      } as any);
                      clearSelectionPanel();
                      await loadHL();
                    } catch (e: any) {
                      alert(e?.message ?? "Failed to save highlight (are you a group member?)");
                    }
                  }}
                >
                  Save highlight
                </button>
                <button type="button" className="text-sm underline" onClick={clearSelectionPanel}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* highlights list */}
      <div className="mt-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Highlights</div>
          <button type="button" className="text-xs underline" onClick={loadHL} disabled={loadingHL}>
            {loadingHL ? "Loading…" : "Refresh"}
          </button>
        </div>
        {!loadingHL && highlights.length === 0 && <div className="text-sm opacity-70 mt-2">No highlights yet.</div>}
        {highlights.length > 0 && (
          <ul className="mt-2 space-y-2">
            {highlights
              .slice()
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((h) => (
                <li key={h.id} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs opacity-70">
                        {new Date(h.created_at).toLocaleString()} •{" "}
                        <span className="uppercase tracking-wide text-[10px]">{h.visibility}</span>
                      </div>
                      <div className="mt-1 text-sm">
                        “{h.selected_text.length > 140 ? h.selected_text.slice(0, 140) + "…" : h.selected_text}”
                      </div>
                      {h.note && <div className="text-xs opacity-70 mt-1">Note: {h.note}</div>}
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        type="button"
                        className="text-xs underline text-red-500 disabled:opacity-50"
                        onClick={async () => {
                          const { data } = await supabase.auth.getUser();
                          const me = data.user?.id;
                          if (!me || me !== h.user_id) {
                            alert("Only the author can delete this highlight.");
                            return;
                          }
                          if (!confirm("Delete this highlight?")) return;
                          setDeletingHLId(h.id);
                          try {
                            await deleteEntryHighlight(h.id as any);
                            await loadHL();
                          } catch (e: any) {
                            alert(e?.message ?? "Failed to delete");
                          } finally {
                            setDeletingHLId(null);
                          }
                        }}
                        disabled={deletingHLId === h.id}
                      >
                        {deletingHLId === h.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>
    </li>
  );
}
