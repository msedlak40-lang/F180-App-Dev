import * as React from "react";
import { Search, ChevronDown, ChevronRight, MoreHorizontal, Archive } from "lucide-react";
import {
  listSeriesForGroup,
  listEntries,
  getMyProgressForSeries,
  markEntryRead,
  toggleArchiveEntry,
  createSeriesWithEntries,
  listMyHighlightsForSeries,
  addHighlight,
  removeHighlight,
  listQuestionsForEntries,
  listMyAnswers,
  saveMyAnswer,
  deleteMyAnswer,
  type StudySeries,
  type StudyEntry,
  type StudyEntryProgress,
  type StudyQuestion,
  type StudyAnswer,
  listFlagsForEntries,
  toggleBookmarkEntry,
  listMyBookmarkedEntries,
  listMyArchivedEntries,
  // collaboration
  mySeriesCapabilities,
  listCollaborators,
  removeCollaboratorByUser,
  listInvites,
  revokeInvite,
  createInviteLinkSimple,
  type StudyCollaborator,
  type StudyInvite,
} from "../../services/study.f180";
import GenerateStudyModalF180 from "./GenerateStudyModalF180";
import "../../styles/f180.css";

type Props = { groupId: string };
type TabKey = "study" | "highlights" | "bookmarks" | "archived";

export default function StudyTabF180({ groupId }: Props) {
  const [tab, setTab] = React.useState<TabKey>("study");

  // base state
  const [loading, setLoading] = React.useState(true);
  const [series, setSeries] = React.useState<StudySeries[]>([]);
  const [entriesBySeries, setEntriesBySeries] = React.useState<Record<string, StudyEntry[]>>({});
  const [progressByEntry, setProgressByEntry] = React.useState<Record<string, StudyEntryProgress>>({});
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [query, setQuery] = React.useState("");
  const [hideArchived, setHideArchived] = React.useState(true);

  // episode rail selection (one entry visible at a time)
  const [selectedEntryBySeries, setSelectedEntryBySeries] = React.useState<Record<string, string>>({});

  // highlights (per entry -> selected sentence indexes)
  const [localHighlights, setLocalHighlights] = React.useState<Record<string, number[]>>({});

  // questions & answers
  const [questionsByEntry, setQuestionsByEntry] = React.useState<Record<string, StudyQuestion[]>>({});
  const [myAnswers, setMyAnswers] = React.useState<Record<string, StudyAnswer>>({});
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [savingQ, setSavingQ] = React.useState<string | null>(null);
  const [errQ, setErrQ] = React.useState<Record<string, string>>({});
  const [showAI, setShowAI] = React.useState<Record<string, boolean>>({});

  // entry flags
  const [bookmarkedIds, setBookmarkedIds] = React.useState<Set<string>>(new Set());
  const [archivedIds, setArchivedIds] = React.useState<Set<string>>(new Set());

  // direct data for tabs
  const [bookmarkedBySeries, setBookmarkedBySeries] = React.useState<Record<string, StudyEntry[]>>({});
  const [archivedBySeries, setArchivedBySeries] = React.useState<Record<string, StudyEntry[]>>({});

  // collaboration panel open state per series
  const [collabOpen, setCollabOpen] = React.useState<Record<string, boolean>>({});

  // ---------- initial load ----------
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await listSeriesForGroup({ groupId, onlyMine: true });
        if (!mounted) return;
        setSeries(s);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [groupId]);

  // ---------- load tab data ----------
  React.useEffect(() => {
    (async () => {
      const seriesIdSet = new Set(series.map((s) => s.id));
      if (tab === "bookmarks") {
        const { bySeries, ids } = await listMyBookmarkedEntries();
        const filtered: Record<string, StudyEntry[]> = {};
        Object.entries(bySeries).forEach(([sid, rows]) => {
          if (seriesIdSet.has(sid)) filtered[sid] = rows;
        });
        setBookmarkedBySeries(filtered);
        setBookmarkedIds(ids);
      } else if (tab === "archived") {
        const { bySeries, ids } = await listMyArchivedEntries();
        const filtered: Record<string, StudyEntry[]> = {};
        Object.entries(bySeries).forEach(([sid, rows]) => {
          if (seriesIdSet.has(sid)) filtered[sid] = rows;
        });
        setArchivedBySeries(filtered);
        setArchivedIds(ids);
      }
    })();
  }, [tab, groupId, series]);

  // ---------- helpers ----------
  const LS_KEY = (sid: string) => `f180_study_last_entry_${sid}`;

  function setSelectedEntry(sid: string, entryId: string | null) {
    setSelectedEntryBySeries((prev) => ({ ...prev, [sid]: entryId || "" }));
    if (entryId) {
      try {
        localStorage.setItem(LS_KEY(sid), entryId);
      } catch {}
    }
  }

  function getSelectedEntry(sid: string): StudyEntry | null {
    const eid = selectedEntryBySeries[sid] || "";
    const arr = entriesBySeries[sid] || [];
    return arr.find((x) => x.id === eid) || null;
  }

  function resumeEntryId(sid: string): string | null {
    try {
      return localStorage.getItem(LS_KEY(sid));
    } catch {
      return null;
    }
  }

  async function ensureEntries(seriesId: string) {
    if (entriesBySeries[seriesId]) return;
    const [rows, prog, hlMap] = await Promise.all([
      listEntries({ seriesId }),
      getMyProgressForSeries({ seriesId }),
      listMyHighlightsForSeries({ seriesId }),
    ]);
    setEntriesBySeries((prev) => ({ ...prev, [seriesId]: rows }));
    setProgressByEntry((prev) => ({ ...prev, ...prog }));
    setLocalHighlights((prev) => ({ ...prev, ...hlMap }));

    // default selection: resume (LS) or first
    const resume = resumeEntryId(seriesId);
    const defaultId = resume && rows.some((r) => r.id === resume) ? resume : rows[0]?.id || null;
    if (defaultId) setSelectedEntry(seriesId, defaultId);

    // questions + my answers
    const entryIds = rows.map((e) => e.id);
    if (entryIds.length) {
      const qmap = await listQuestionsForEntries(entryIds);
      setQuestionsByEntry((prev) => ({ ...prev, ...qmap }));
      const qids: string[] = [];
      Object.values(qmap).forEach((arr) => arr.forEach((q) => qids.push(q.id)));
      if (qids.length) {
        const mine = await listMyAnswers(qids);
        setMyAnswers((prev) => ({ ...prev, ...mine }));
        setDrafts((prev) => {
          const init = { ...prev };
          Object.entries(mine).forEach(([qid, ans]) => (init[qid] = ans.content ?? ""));
          return init;
        });
      }

      // entry flags
      const { bookmarked, archived } = await listFlagsForEntries(entryIds);
      setBookmarkedIds((prev) => new Set([...prev, ...bookmarked]));
      setArchivedIds((prev) => new Set([...prev, ...archived]));
    }
  }

  function toggleExpand(seriesId: string) {
    setExpanded((prev) => {
      const open = !prev[seriesId];
      if (open) ensureEntries(seriesId);
      return { ...prev, [seriesId]: open };
    });
  }

  function sentenceSplit(md: string): string[] {
    const parts = md.replace(/\n+/g, " ").match(/[^.!?]+[.!?]?/g);
    return parts || [md];
  }

  async function toggleSentence(entry: StudyEntry, idx: number, text: string) {
    const wasOn = (localHighlights[entry.id] || []).includes(idx);
    setLocalHighlights((prev) => {
      const set = new Set(prev[entry.id] || []);
      if (set.has(idx)) set.delete(idx);
      else set.add(idx);
      return { ...prev, [entry.id]: Array.from(set).sort((a, b) => a - b) };
    });
    try {
      if (wasOn) {
        await removeHighlight({ entryId: entry.id, sentence_index: idx });
      } else {
        await addHighlight({ entryId: entry.id, sentence_index: idx, text: text.trim() });
      }
    } catch (err) {
      setLocalHighlights((prev) => {
        const set = new Set(prev[entry.id] || []);
        if (wasOn) set.add(idx);
        else set.delete(idx);
        return { ...prev, [entry.id]: Array.from(set).sort((a, b) => a - b) };
      });
      alert((err as any)?.message || "Highlight error");
    }
  }

  async function onMarkRead(entryId: string) {
    await markEntryRead({ entryId });
    setProgressByEntry((prev) => ({
      ...prev,
      [entryId]: {
        ...(prev[entryId] || { entry_id: entryId, user_id: "me", is_read: false }),
        is_read: true,
        percent: 100,
        last_read_at: new Date().toISOString(),
      },
    }));
  }

  async function onToggleArchive(entryId: string) {
    const isArchived = archivedIds.has(entryId);
    setArchivedIds((prev) => {
      const next = new Set(prev);
      if (isArchived) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
    try {
      await toggleArchiveEntry({ entryId, archived: !isArchived });
      if (tab === "archived") {
        const { bySeries, ids } = await listMyArchivedEntries();
        const seriesIdSet = new Set(series.map((s) => s.id));
        const filtered: Record<string, StudyEntry[]> = {};
        Object.entries(bySeries).forEach(([sid, rows]) => {
          if (seriesIdSet.has(sid)) filtered[sid] = rows;
        });
        setArchivedBySeries(filtered);
        setArchivedIds(ids);
      }
    } catch (err) {
      setArchivedIds((prev) => {
        const next = new Set(prev);
        if (isArchived) next.add(entryId);
        else next.delete(entryId);
        return next;
      });
      alert((err as any)?.message || "Archive failed");
    }
  }

  async function onToggleBookmarkEntry(entryId: string) {
    const isOn = bookmarkedIds.has(entryId);
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (isOn) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
    try {
      await toggleBookmarkEntry(entryId, !isOn);
      if (tab === "bookmarks") {
        const { bySeries, ids } = await listMyBookmarkedEntries();
        const seriesIdSet = new Set(series.map((s) => s.id));
        const filtered: Record<string, StudyEntry[]> = {};
        Object.entries(bySeries).forEach(([sid, rows]) => {
          if (seriesIdSet.has(sid)) filtered[sid] = rows;
        });
        setBookmarkedBySeries(filtered);
        setBookmarkedIds(ids);
      }
    } catch (err) {
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        if (isOn) next.add(entryId);
        else next.delete(entryId);
        return next;
      });
      alert((err as any)?.message || "Bookmark failed");
    }
  }

  // keyboard nav for the currently-open series with a selected entry
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (tab !== "study") return;
      // find first open series that has a selected entry
      const openSeries = series.find((s) => expanded[s.id] && selectedEntryBySeries[s.id]);
      if (!openSeries) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        moveSelection(openSeries.id, +1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        moveSelection(openSeries.id, -1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, series, expanded, selectedEntryBySeries, entriesBySeries]);

  function moveSelection(sid: string, delta: number) {
    const arr = entriesBySeries[sid] || [];
    if (!arr.length) return;
    const cur = getSelectedEntry(sid);
    const curIdx = cur ? arr.findIndex((x) => x.id === cur.id) : 0;
    const nextIdx = Math.min(Math.max(curIdx + delta, 0), arr.length - 1);
    const next = arr[nextIdx];
    if (next) setSelectedEntry(sid, next.id);
  }

  const visibleSeries = React.useMemo(() => {
    return series.filter((s) => {
      if (tab === "study" && hideArchived) {
        const entries = entriesBySeries[s.id] || [];
        const allArchived = entries.length > 0 && entries.every((e) => archivedIds.has(e.id));
        if (allArchived) return false;
      }
      if (!query) return true;
      return s.title.toLowerCase().includes(query.toLowerCase());
    });
  }, [series, query, hideArchived, tab, entriesBySeries, archivedIds]);

  function highlightedCountForSeries(sid: string) {
    const entries = entriesBySeries[sid] || [];
    let n = 0;
    for (const e of entries) n += (localHighlights[e.id] || []).length;
    return n;
  }

  function setDraft(qid: string, v: string) {
    setDrafts((prev) => ({ ...prev, [qid]: v }));
  }

  async function onSaveAnswer(qid: string) {
    const text = (drafts[qid] ?? "").trim();
    if (!text) return;
    setSavingQ(qid);
    setErrQ((prev) => ({ ...prev, [qid]: "" }));
    try {
      const saved = await saveMyAnswer(qid, text);
      setMyAnswers((prev) => ({ ...prev, [qid]: saved }));
    } catch (e: any) {
      setErrQ((prev) => ({ ...prev, [qid]: e?.message ?? "Failed to save" }));
    } finally {
      setSavingQ(null);
    }
  }

  async function onDeleteAnswer(qid: string) {
    const cur = myAnswers[qid];
    if (!cur) return;
    setSavingQ(qid);
    setErrQ((prev) => ({ ...prev, [qid]: "" }));
    try {
      await deleteMyAnswer(cur.id);
      setMyAnswers((prev) => {
        const { [qid]: _, ...rest } = prev;
        return rest;
      });
      setDrafts((prev) => ({ ...prev, [qid]: "" }));
    } catch (e: any) {
      setErrQ((prev) => ({ ...prev, [qid]: e?.message ?? "Failed to delete" }));
    } finally {
      setSavingQ(null);
    }
  }

  return (
    <div className="f180">
      <div className="max-w-5xl mx-auto px-3 md:px-4 py-4 md:py-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Study (preview)</h1>
            <div className="text-xs md:text-sm opacity-70">
              Episode rail • single-week focus • keyboard nav
            </div>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-2 mb-4">
          {(["study", "highlights", "bookmarks", "archived"] as TabKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3 py-1.5 rounded-full text-sm border ${
                tab === key
                  ? "bg-[hsl(var(--primary))] border-[hsl(var(--primary))] text-white"
                  : "bg-[hsl(var(--secondary))] border-[hsl(var(--border))]"
              }`}
            >
              {key === "study"
                ? "Study"
                : key === "highlights"
                ? "Highlights"
                : key === "bookmarks"
                ? "Bookmarks"
                : "Archived"}
            </button>
          ))}
        </div>

        {/* Filter row (Study tab) */}
        {tab === "study" && (
          <div className="sticky top-2 z-10 p-3 md:p-4 mb-3 border rounded-2xl bg-[hsl(var(--card))]/90 border-[hsl(var(--border))] backdrop-blur">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2 top-2.5 h-4 w-4 opacity-70" />
                <input
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-sm"
                  placeholder="Search my studies…"
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

        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-4">
          {/* LEFT */}
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
            {tab === "study" && (
              <div className="divide-y divide-[hsl(var(--border))]">
                {loading && <div className="p-4 text-sm opacity-70">Loading…</div>}
                {!loading && series.length === 0 && (
                  <div className="p-6 text-sm opacity-70">No studies yet. Use the generator on the right to draft one.</div>
                )}

                {visibleSeries.map((s) => {
                  const isOpen = !!expanded[s.id];
                  const hlCount = highlightedCountForSeries(s.id);
                  const entries = entriesBySeries[s.id] || [];
                  const selected = getSelectedEntry(s.id);
                  const selectedIdx = selected ? entries.findIndex((x) => x.id === selected.id) : -1;

                  return (
                    <div key={s.id} className="p-3 md:p-4">
                      {/* row header */}
                      <div className="flex items-center gap-3">
                        <button
                          className="rounded-lg border border-[hsl(var(--border))] px-2 py-1"
                          onClick={() => toggleExpand(s.id)}
                          aria-label={isOpen ? "Collapse" : "Expand"}
                          title={isOpen ? "Collapse" : "Expand"}
                        >
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="text-sm md:text-base font-medium">{s.title}</div>
                          <div className="text-xs opacity-70 truncate">
                            {(s.section_count ?? 0)} sections · {(s as any).archived_at ? "Archived" : "Active"}
                            {hlCount > 0 ? ` · ${hlCount} highlights` : ""}
                          </div>
                        </div>

                        {/* Continue */}
                        {isOpen && entries.length > 0 && (
                          <button
                            type="button"
                            className="text-xs rounded-xl border px-3 py-1.5 bg-[hsl(var(--secondary))]"
                            onClick={() => {
                              const resume = resumeEntryId(s.id);
                              const target =
                                (resume && entries.find((e) => e.id === resume)?.id) || entries[0]?.id || null;
                              if (target) setSelectedEntry(s.id, target);
                            }}
                          >
                            Continue
                          </button>
                        )}

                        {/* Collaborators */}
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
                        <div className="mt-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
                          <StudySeriesCollaboratorsPanel seriesId={s.id} />
                        </div>
                      )}

                      {/* EPISODE RAIL + ONE ENTRY VIEW */}
                      {isOpen && (
                        <div className="mt-3 md:mt-4 space-y-4">
                          {/* Episode rail */}
                          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] p-2 overflow-x-auto">
                            <div className="flex items-center gap-2">
                              {entries.length === 0 && (
                                <div className="text-xs opacity-70 px-2 py-1">No sections yet.</div>
                              )}
                              {entries.map((e, idx) => {
                                const read = !!progressByEntry[e.id]?.is_read;
                                const isBookmarked = bookmarkedIds.has(e.id);
                                const isArchived = archivedIds.has(e.id);
                                const active = selected?.id === e.id;
                                return (
                                  <button
                                    key={e.id}
                                    onClick={() => setSelectedEntry(s.id, e.id)}
                                    className={`text-xs rounded-full border px-3 py-1.5 whitespace-nowrap transition ${
                                      active
                                        ? "bg-[hsl(var(--primary))] border-[hsl(var(--primary))] text-white"
                                        : "bg-[hsl(var(--card))] border-[hsl(var(--border))]"
                                    } ${isArchived ? "opacity-60" : ""}`}
                                    title={e.title || `Week ${e.position ?? idx + 1}`}
                                  >
                                    <span className="mr-2 opacity-80">Week {e.position ?? idx + 1}</span>
                                    {read && <span className="inline-block h-2 w-2 rounded-full bg-white/80 align-middle" />}
                                    {isBookmarked && !read && (
                                      <span className="inline-block h-2 w-2 rounded-full bg-black/60 align-middle" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* One entry content */}
                          {selected ? (
                            <EntryReader
                              entry={selected}
                              weekIndex={selectedIdx >= 0 ? selectedIdx + 1 : undefined}
                              sentences={sentenceSplit(selected.content || "")}
                              selectedSentenceIdx={new Set(localHighlights[selected.id] || [])}
                              onToggleSentence={(i, txt) => toggleSentence(selected, i, txt)}
                              read={!!progressByEntry[selected.id]?.is_read}
                              onMarkRead={() => onMarkRead(selected.id)}
                              isBookmarked={bookmarkedIds.has(selected.id)}
                              onToggleBookmark={() => onToggleBookmarkEntry(selected.id)}
                              isArchived={archivedIds.has(selected.id)}
                              onToggleArchive={() => onToggleArchive(selected.id)}
                              questions={questionsByEntry[selected.id] || []}
                              drafts={drafts}
                              setDraft={setDraft}
                              savingQ={savingQ}
                              errQ={errQ}
                              showAI={showAI}
                              setShowAI={setShowAI}
                              onSaveAnswer={onSaveAnswer}
                              onDeleteAnswer={onDeleteAnswer}
                              onPrev={() => moveSelection(s.id, -1)}
                              onNext={() => moveSelection(s.id, +1)}
                              hasPrev={selectedIdx > 0}
                              hasNext={selectedIdx >= 0 && selectedIdx < entries.length - 1}
                            />
                          ) : (
                            entries.length > 0 && (
                              <div className="text-sm opacity-70">Select a week from the rail above to begin.</div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Highlights tab */}
            {tab === "highlights" && (
              <div className="p-3 md:p-4">
                <div className="text-sm font-semibold mb-2">My Highlights</div>
                <div className="text-xs opacity-70 mb-3">
                  Organizer ideas: group by Series / Tag / Recency. (Prototype shows Series grouping.)
                </div>

                {series.map((s) => {
                  const entries = entriesBySeries[s.id] || [];
                  const rows = entries.flatMap((e) => {
                    const idxs = localHighlights[e.id] || [];
                    const sentences =
                      (e.content || "").replace(/\n+/g, " ").match(/[^.!?]+[.!?]?/g) || [e.content || ""];
                    return idxs.map((i) => ({ entry: e, text: (sentences[i] || "").trim(), idx: i }));
                  });
                  if (rows.length === 0) return null;
                  return (
                    <div key={s.id} className="mb-4">
                      <div className="text-sm font-medium mb-2">{s.title}</div>
                      <div className="space-y-2">
                        {rows.map((r, i) => (
                          <div
                            key={s.id + r.entry.id + i}
                            className="rounded-xl border border-[hsl(var(--border))] p-3 bg-[hsl(var(--secondary))]"
                          >
                            <div className="text-sm">{r.text}</div>
                            <div className="mt-1 text-xs opacity-70">Section: {r.entry.title}</div>
                            <div className="mt-2 flex gap-2">
                              <button
                                className="text-xs rounded-lg border px-2 py-1"
                                onClick={() => navigator.clipboard?.writeText(r.text)}
                              >
                                Copy
                              </button>
                              <button
                                className="text-xs rounded-lg border px-2 py-1"
                                onClick={() => {
                                  setTab("study");
                                  setExpanded((prev) => ({ ...prev, [s.id]: true }));
                                  setSelectedEntry(s.id, r.entry.id);
                                }}
                              >
                                Open in Study
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {series.every((s) => localHighlightsForSeries(s.id, entriesBySeries, localHighlights).length === 0) && (
                  <div className="text-sm opacity-70">No highlights yet. Click sentences in the Study tab to add some.</div>
                )}
              </div>
            )}

            {/* Bookmarks tab */}
            {tab === "bookmarks" && (
              <div className="p-3 md:p-4">
                <div className="text-sm font-semibold mb-2">Bookmarked Lessons</div>
                {series.map((s) => {
                  const entries = bookmarkedBySeries[s.id] || [];
                  if (entries.length === 0) return null;
                  return (
                    <div key={s.id} className="mb-4">
                      <div className="text-sm font-medium mb-2">{s.title}</div>
                      <div className="grid gap-2">
                        {entries.map((e) => (
                          <div key={e.id} className="rounded-xl border border-[hsl(var(--border))] p-3 bg-[hsl(var(--secondary))]">
                            <div className="text-sm font-medium">{e.title}</div>
                            <div className="mt-1 text-xs opacity-70">Week {e.position}</div>
                            <div className="mt-2 flex gap-2">
                              <button
                                className="text-xs rounded-lg border px-2 py-1"
                                onClick={() => {
                                  setTab("study");
                                  setExpanded((prev) => ({ ...prev, [s.id]: true }));
                                  setSelectedEntry(s.id, e.id);
                                }}
                              >
                                Open in Study
                              </button>
                              <button
                                className="text-xs rounded-lg border px-2 py-1"
                                onClick={async () => {
                                  await onToggleBookmarkEntry(e.id);
                                }}
                              >
                                Remove bookmark
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {Object.values(bookmarkedBySeries).every((arr) => (arr?.length || 0) === 0) && (
                  <div className="text-sm opacity-70">No bookmarks yet. Add some from the Study tab.</div>
                )}
              </div>
            )}

            {/* Archived tab */}
            {tab === "archived" && (
              <div className="p-3 md:p-4">
                <div className="text-sm font-semibold mb-2">Archived Lessons</div>
                {series.map((s) => {
                  const entries = archivedBySeries[s.id] || [];
                  if (entries.length === 0) return null;
                  return (
                    <div key={s.id} className="mb-4">
                      <div className="text-sm font-medium mb-2">{s.title}</div>
                      <div className="grid gap-2">
                        {entries.map((e) => (
                          <div key={e.id} className="rounded-xl border border-[hsl(var(--border))] p-3 bg-[hsl(var(--secondary))]">
                            <div className="text-sm font-medium">{e.title}</div>
                            <div className="mt-1 text-xs opacity-70">Week {e.position}</div>
                            <div className="mt-2 flex gap-2">
                              <button
                                className="text-xs rounded-lg border px-2 py-1"
                                onClick={() => {
                                  setTab("study");
                                  setExpanded((prev) => ({ ...prev, [s.id]: true }));
                                  setSelectedEntry(s.id, e.id);
                                }}
                              >
                                Open in Study
                              </button>
                              <button
                                className="text-xs rounded-lg border px-2 py-1"
                                onClick={async () => {
                                  await onToggleArchive(e.id);
                                }}
                              >
                                Unarchive
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {Object.values(archivedBySeries).every((arr) => (arr?.length || 0) === 0) && (
                  <div className="text-sm opacity-70">Nothing archived yet.</div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT */}
          <aside className="space-y-4">
            {/* Generator */}
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
              <div className="text-sm font-semibold mb-2">Generator</div>
              <GenerateStudyModalF180
                groupId={groupId}
                onInsert={async (draft) => {
                  try {
                    const { series: created, entries } = await createSeriesWithEntries({
                      groupId,
                      title: draft.title || "Untitled study",
                      description: null,
                      sections: draft.sections.map((body, i) => ({
                        title: `Week ${i + 1}`,
                        body_md: body,
                        day_index: i + 1,
                      })),
                      generated: false,
                      generator_model: null,
                      generator_meta: { source: "manual-f180" },
                    });

                    setSeries((prev) => [created, ...prev]);
                    setTab("study");
                    setExpanded((prev) => ({ ...prev, [created.id]: true }));
                    setEntriesBySeries((prev) => ({ ...prev, [created.id]: entries }));
                    if (entries[0]) setSelectedEntry(created.id, entries[0].id);
                  } catch (err: any) {
                    alert(`Failed to create study: ${err?.message || err}`);
                  }
                }}
                onServerCreated={async (seriesId) => {
                  try {
                    const all = await listSeriesForGroup({ groupId, onlyMine: true });
                    const created = all.find((s) => s.id === seriesId) ?? null;
                    setSeries(all);

                    const [entries, hlMap] = await Promise.all([
                      listEntries({ seriesId }),
                      listMyHighlightsForSeries({ seriesId }),
                    ]);

                    setEntriesBySeries((prev) => ({ ...prev, [seriesId]: entries }));
                    setLocalHighlights((prev) => ({ ...prev, ...hlMap }));
                    setTab("study");
                    setExpanded((prev) => ({ ...prev, [seriesId]: true }));
                    if (entries[0]) setSelectedEntry(seriesId, entries[0].id);

                    // questions + answers + flags
                    const entryIds = entries.map((e) => e.id);
                    if (entryIds.length) {
                      const qmap = await listQuestionsForEntries(entryIds);
                      setQuestionsByEntry((prev) => ({ ...prev, ...qmap }));
                      const qids: string[] = [];
                      Object.values(qmap).forEach((arr) => arr.forEach((q) => qids.push(q.id)));
                      if (qids.length) {
                        const mine = await listMyAnswers(qids);
                        setMyAnswers((prev) => ({ ...prev, ...mine }));
                        setDrafts((prev) => {
                          const init = { ...prev };
                          Object.entries(mine).forEach(([qid, ans]) => (init[qid] = ans.content ?? ""));
                          return init;
                        });
                      }

                      const { bySeries: bmBy, ids: bmIds } = await listMyBookmarkedEntries();
                      const { bySeries: arBy, ids: arIds } = await listMyArchivedEntries();
                      const seriesIdSet = new Set(all.map((x) => x.id));
                      const filteredBm: Record<string, StudyEntry[]> = {};
                      const filteredAr: Record<string, StudyEntry[]> = {};
                      Object.entries(bmBy).forEach(([sid, rows]) => {
                        if (seriesIdSet.has(sid)) filteredBm[sid] = rows;
                      });
                      Object.entries(arBy).forEach(([sid, rows]) => {
                        if (seriesIdSet.has(sid)) filteredAr[sid] = rows;
                      });
                      setBookmarkedBySeries(filteredBm);
                      setBookmarkedIds(bmIds);
                      setArchivedBySeries(filteredAr);
                      setArchivedIds(arIds);
                    }

                    if (!created) {
                      console.warn("Series created by server but not visible under onlyMine; check RLS/owner_id.");
                    }
                  } catch (err: any) {
                    alert(`Load error: ${err?.message || err}`);
                  }
                }}
              />
            </div>

            {/* Collections / Bookmarks quick link */}
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
              <div className="text-sm font-semibold mb-2">Collections</div>
              <div className="text-xs opacity-70">Series Collections (future). Your lesson bookmarks live in the tab.</div>
              <div className="mt-2">
                <button className="text-xs rounded-lg border px-3 py-2" onClick={() => setTab("bookmarks")}>
                  Open Bookmarks
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function localHighlightsForSeries(
  sid: string,
  entriesBySeries: Record<string, StudyEntry[]>,
  localHighlights: Record<string, number[]>
) {
  const entries = entriesBySeries[sid] || [];
  return entries.flatMap((e) => localHighlights[e.id] || []);
}

/* ---------- One-entry reader component (episode view) ---------- */
function EntryReader(props: {
  entry: StudyEntry;
  weekIndex?: number;
  sentences: string[];
  selectedSentenceIdx: Set<number>;
  onToggleSentence: (i: number, text: string) => void;
  read: boolean;
  onMarkRead: () => void;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  isArchived: boolean;
  onToggleArchive: () => void;
  questions: StudyQuestion[];
  drafts: Record<string, string>;
  setDraft: (qid: string, v: string) => void;
  savingQ: string | null;
  errQ: Record<string, string>;
  showAI: Record<string, boolean>;
  setShowAI: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onSaveAnswer: (qid: string) => void;
  onDeleteAnswer: (qid: string) => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  const {
    entry,
    weekIndex,
    sentences,
    selectedSentenceIdx,
    onToggleSentence,
    read,
    onMarkRead,
    isBookmarked,
    onToggleBookmark,
    isArchived,
    onToggleArchive,
    questions,
    drafts,
    setDraft,
    savingQ,
    errQ,
    showAI,
    setShowAI,
    onSaveAnswer,
    onDeleteAnswer,
    onPrev,
    onNext,
    hasPrev,
    hasNext,
  } = props;

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] p-3 md:p-4 bg-[hsl(var(--secondary))]">
      {/* entry toolbar */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-sm font-medium">
          {weekIndex ? `Week ${weekIndex}` : "Lesson"}{entry.title ? ` — ${entry.title}` : ""}
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`text-xs rounded-lg border px-2 py-1 ${read ? "opacity-70" : ""}`}
            onClick={onMarkRead}
          >
            {read ? "Read" : "Mark read"}
          </button>
          <button
            className={`text-xs rounded-lg border px-2 py-1 ${isBookmarked ? "bg-[hsl(var(--primary))]/10" : ""}`}
            onClick={onToggleBookmark}
            title={isBookmarked ? "Remove bookmark" : "Bookmark this lesson"}
          >
            {isBookmarked ? "Bookmarked" : "Bookmark"}
          </button>
          <button
            className="text-xs rounded-lg border px-2 py-1"
            onClick={onToggleArchive}
            title={isArchived ? "Unarchive this lesson" : "Archive this lesson"}
          >
            <div className="flex items-center gap-1">
              <Archive className="h-3.5 w-3.5" /> {isArchived ? "Unarchive" : "Archive"}
            </div>
          </button>
          {/* prev/next */}
          <div className="ml-2 flex items-center gap-2">
            <button
              className="text-xs rounded-lg border px-2 py-1"
              disabled={!hasPrev}
              onClick={onPrev}
              title="Previous week (←)"
            >
              Prev
            </button>
            <button
              className="text-xs rounded-lg border px-2 py-1"
              disabled={!hasNext}
              onClick={onNext}
              title="Next week (→)"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* content with sentence highlights */}
      <div className="text-sm leading-6">
        {sentences.map((snt, i) => {
          const on = selectedSentenceIdx.has(i);
          return (
            <span
              key={i}
              onClick={() => onToggleSentence(i, snt)}
              className={`cursor-pointer hover:underline rounded px-0.5 ${
                on ? "bg-[hsl(var(--accent))]/30 ring-1 ring-[hsl(var(--accent))]" : ""
              }`}
              title={on ? "Remove highlight" : "Highlight sentence"}
            >
              {snt}{" "}
            </span>
          );
        })}
      </div>

      {/* questions */}
      {questions.length > 0 ? (
        <div className="mt-4 rounded-xl border bg-[hsl(var(--card))] p-3">
          <div className="text-sm font-semibold mb-2">Guided Questions</div>
          <div className="grid gap-2">
            {questions.map((q, qi) => {
              const qnum = q.position ?? qi + 1;
              const open = !!showAI[q.id];

              return (
                <div key={q.id} className="rounded-lg border p-2 bg-[hsl(var(--secondary))]">
                  <div className="text-sm font-medium">Q{qnum}. {q.prompt ?? ""}</div>

                  {!!q.ai_answer && (
                    <div className="mt-2">
                      <button
                        type="button"
                        className="text-xs underline"
                        onClick={() => setShowAI((prev) => ({ ...prev, [q.id]: !prev[q.id] }))}
                      >
                        {open ? "Hide AI answer" : "Show AI answer"}
                      </button>
                      {open && (
                        <div className="mt-1 text-sm border rounded p-2 whitespace-pre-wrap bg-black/10">
                          {q.ai_answer}
                        </div>
                      )}
                    </div>
                  )}

                  {/* My Answer */}
                  <div className="mt-2 rounded-lg border bg-[hsl(var(--card))] p-2">
                    <div className="text-xs font-medium opacity-70 mb-1">My Answer</div>
                    <textarea
                      className="w-full text-sm border rounded-md p-2 bg-[hsl(var(--secondary))]"
                      rows={3}
                      placeholder="Write your answer…"
                      value={drafts[q.id] ?? ""}
                      onChange={(ev) => setDraft(q.id, ev.target.value)}
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        className="text-sm rounded-lg border px-3 py-1.5"
                        disabled={savingQ === q.id || !(drafts[q.id] ?? "").trim()}
                        onClick={() => onSaveAnswer(q.id)}
                      >
                        {/* if there's a saved answer for this question, call it update */}
                        {drafts[q.id] && drafts[q.id].trim() && !errQ[q.id] && q.id in drafts ? ( /* simple heuristic */
                          "Save"
                        ) : (
                          "Save"
                        )}
                      </button>
                      {!!(errQ[q.id]?.length) && (
                        <span className="text-xs text-red-400">{errQ[q.id]}</span>
                      )}
                      {savingQ === q.id && <span className="text-xs opacity-70">Saving…</span>}
                      {/* delete appears only if there is a saved answer */}
                      {/* (the parent page already sets drafts from saved answers on load) */}
                      {Boolean(props.drafts[q.id]) && (
                        <button
                          type="button"
                          className="text-sm rounded-lg border px-3 py-1.5"
                          onClick={() => onDeleteAnswer(q.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-3 text-xs opacity-70">No questions yet for this section.</div>
      )}

      <div className="mt-2 text-xs opacity-70">{selectedSentenceIdx.size} highlighted sentence{selectedSentenceIdx.size === 1 ? "" : "s"}</div>
    </div>
  );
}

function StudySeriesCollaboratorsPanel({ seriesId }: { seriesId: string }) {
  const [caps, setCaps] = React.useState<{ can_edit: boolean }>({ can_edit: false });
  const [collab, setCollab] = React.useState<StudyCollaborator[]>([]);
  const [invites, setInvites] = React.useState<StudyInvite[]>([]);
  const [role, setRole] = React.useState<"editor" | "viewer">("viewer");
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const [c1, c2, c3] = await Promise.all([
        mySeriesCapabilities(seriesId),
        listCollaborators(seriesId),
        listInvites(seriesId),
      ]);
      setCaps(c1);
      setCollab(c2);
      setInvites(c3.filter((iv) => !iv.revoked_at));
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load collaborators");
    } finally {
      setBusy(false);
    }
  }, [seriesId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const onCreateInvite = async () => {
    setBusy(true);
    setErr(null);
    try {
      await createInviteLinkSimple(seriesId, role, email.trim() || undefined);
      setEmail("");
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create invite");
    } finally {
      setBusy(false);
    }
  };

  const onRevoke = async (inviteId: string) => {
    setBusy(true);
    setErr(null);
    try {
      await revokeInvite(inviteId);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to revoke invite");
    } finally {
      setBusy(false);
    }
  };

  const onRemoveUser = async (userId: string) => {
    if (!confirm("Remove this collaborator?")) return;
    setBusy(true);
    setErr(null);
    try {
      await removeCollaboratorByUser(seriesId, userId);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to remove collaborator");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard?.writeText(text);
      alert("Copied link");
    } catch {
      alert("Couldn’t copy");
    }
  };

  const inviteHref = (token: string) =>
    `${location.origin}/#/accept-study-invite?token=${encodeURIComponent(token)}`;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">Collaborators</div>
        <button type="button" className="text-xs underline" onClick={load} disabled={busy}>
          Refresh
        </button>
      </div>
      {err && (
        <div className="mt-2 text-xs" style={{ color: "hsla(0,75%,60%,1)" }}>
          {err}
        </div>
      )}

      {/* current collaborators */}
      <div className="mt-3">
        <div className="text-xs opacity-70 mb-1">Current collaborators</div>
        {collab.length === 0 ? (
          <div className="text-xs opacity-70">No collaborators yet.</div>
        ) : (
          <ul className="space-y-1">
            {collab.map((c) => (
              <li key={c.user_id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm">
                    {c.display_name || c.email || c.user_id.slice(0, 8)}{" "}
                    <span className="ml-1 text-xs opacity-60">({c.role})</span>
                  </div>
                  {c.email && <div className="text-[11px] opacity-60">{c.email}</div>}
                </div>
                <div className="shrink-0">
                  {caps.can_edit && (
                    <button
                      type="button"
                      className="text-xs rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-0.5"
                      onClick={() => onRemoveUser(c.user_id)}
                      disabled={busy}
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

      {/* create invite — always visible; RLS enforces perms */}
      <div className="mt-4">
        <div className="text-xs opacity-70 mb-1">Create invite</div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="text-xs rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1"
            value={role}
            onChange={(e) => setRole(e.target.value as "editor" | "viewer")}
            disabled={busy}
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <input
            type="email"
            placeholder="Lock to email (optional)"
            className="text-xs rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
          <button
            type="button"
            className="text-xs rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1"
            onClick={onCreateInvite}
            disabled={busy}
          >
            Create invite
          </button>
        </div>
        <div className="text-[11px] opacity-60 mt-1">
          Your permissions are enforced by Supabase. If you don’t have access, the request will fail.
        </div>
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
                  <div className="text-sm">
                    {iv.email_lock ? `${iv.email_lock} (locked)` : "Open"} • {iv.role}
                  </div>
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
                    disabled={busy}
                  >
                    Copy link
                  </button>
                  <button
                    type="button"
                    className="text-xs rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-0.5"
                    onClick={() => onRevoke(iv.id)}
                    disabled={busy}
                  >
                    Revoke
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
