import React from 'react';
import { supabase } from '../../lib/supabaseClient';
import GenerateStudyModal from '../../components/GenerateStudyModal';
import ExportStudyButton from '../../components/ExportStudyButton';

import {
  listSeriesCollaborators,
  inviteStudyByEmail,
  createStudyInviteLink,
  type StudyCollaborator,
  listMyAnswers,
  saveMyAnswer,
  deleteMyAnswer,
  type StudyAnswer,
} from '../../services/study';

type StudySeries = {
  id: string;
  title: string;
  description: string | null;
  visibility: 'group' | 'leader' | 'private';
  created_at: string;
};

type StudyEntry = {
  id: string;
  title: string | null;
  content: string | null;
  focus_ref: string | null;
  position: number | null;
};

type StudyQuestion = {
  id: string;
  entry_id: string;
  prompt: string | null;
  content: string | null;
  ai_answer: string | null;
  position: number | null;
};

function useActiveSeriesIdFromHash() {
  const [seriesId, setSeriesId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const update = () => {
      const hash = window.location.hash || '#/';
      const query = hash.split('?')[1] || '';
      const params = new URLSearchParams(query);
      setSeriesId(params.get('series'));
    };
    update();
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  return seriesId;
}

export default function StudyTab({ groupId }: { groupId: string }) {
  const activeSeriesId = useActiveSeriesIdFromHash();

  // Series list
  const [series, setSeries] = React.useState<StudySeries[]>([]);
  const [loadingSeries, setLoadingSeries] = React.useState(false);
  const [seriesErr, setSeriesErr] = React.useState<string | null>(null);

  // Active series entries + questions
  const [entries, setEntries] = React.useState<(StudyEntry & { questions: StudyQuestion[] })[]>(
    []
  );
  const [loadingEntries, setLoadingEntries] = React.useState(false);
  const [entriesErr, setEntriesErr] = React.useState<string | null>(null);

  // Toggle for showing AI answers per question
  const [showAI, setShowAI] = React.useState<Record<string, boolean>>({});

  // --- collaborators state (inline panel) ---
  const [collabs, setCollabs] = React.useState<StudyCollaborator[]>([]);
  const [collabLoading, setCollabLoading] = React.useState(false);
  const [collabErr, setCollabErr] = React.useState<string | null>(null);
  const [invEmail, setInvEmail] = React.useState('');
  const [invRole, setInvRole] = React.useState<'viewer' | 'editor'>('viewer');
  const [linkRole, setLinkRole] = React.useState<'viewer' | 'editor'>('viewer');
  const [linkUrl, setLinkUrl] = React.useState<string | null>(null);
  const [collabWorking, setCollabWorking] = React.useState(false);

  // --- my answers state ---
  const [myAnswers, setMyAnswers] = React.useState<Record<string, StudyAnswer>>({});
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [savingQ, setSavingQ] = React.useState<string | null>(null);
  const [errQ, setErrQ] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    let mounted = true;
    async function loadSeries() {
      setLoadingSeries(true);
      setSeriesErr(null);
      try {
        const { data, error } = await supabase
          .from('study_series')
          .select('id, title, description, created_at, visibility')
          .eq('group_id', groupId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (!mounted) return;
        setSeries((data ?? []) as StudySeries[]);
      } catch (e: any) {
        if (!mounted) return;
        setSeriesErr(e?.message ?? 'Failed to load study series');
      } finally {
        if (mounted) setLoadingSeries(false);
      }
    }
    loadSeries();
    return () => {
      mounted = false;
    };
  }, [groupId]);

  React.useEffect(() => {
    if (!activeSeriesId) {
      setEntries([]);
      setEntriesErr(null);
      setMyAnswers({});
      setDrafts({});
      return;
    }
    let mounted = true;
    async function loadEntriesAndQuestions() {
      setLoadingEntries(true);
      setEntriesErr(null);
      try {
        // entries first
        const { data: entriesData, error: eErr } = await supabase
          .from('study_entries')
          .select('id, title, content, focus_ref, position')
          .eq('series_id', activeSeriesId)
          .order('position', { ascending: true });
        if (eErr) throw eErr;

        const entryList = (entriesData ?? []) as StudyEntry[];
        const entryIds = entryList.map((e) => e.id);

        let questionsByEntry: Record<string, StudyQuestion[]> = {};
        if (entryIds.length) {
          const { data: qs, error: qErr } = await supabase
            .from('study_questions')
            .select('id, entry_id, prompt, content, ai_answer, position')
            .in('entry_id', entryIds)
            .order('entry_id', { ascending: true })
            .order('position', { ascending: true });
          if (qErr) throw qErr;

          (qs ?? []).forEach((q) => {
            const key = (q as any).entry_id as string;
            (questionsByEntry[key] ||= []).push(q as StudyQuestion);
          });
        }

        const composed = entryList.map((e) => ({
          ...e,
          questions: questionsByEntry[e.id] ?? [],
        }));

        if (!mounted) return;
        setEntries(composed);

        // Load my answers for these questions and seed drafts
        const qids: string[] = [];
        composed.forEach((en) => en.questions.forEach((q) => qids.push(q.id)));
        if (qids.length) {
          try {
            const mine = await listMyAnswers(qids);
            if (!mounted) return;
            setMyAnswers(mine);
            const init: Record<string, string> = {};
            Object.entries(mine).forEach(([qid, ans]) => {
              init[qid] = ans.content ?? '';
            });
            setDrafts(init);
          } catch (err) {
            console.warn('load my answers failed', err);
          }
        } else {
          setMyAnswers({});
          setDrafts({});
        }
      } catch (e: any) {
        if (!mounted) return;
        setEntriesErr(e?.message ?? 'Failed to load entries/questions');
      } finally {
        if (mounted) setLoadingEntries(false);
      }
    }
    loadEntriesAndQuestions();
    return () => {
      mounted = false;
    };
  }, [activeSeriesId]);

  // Load collaborators when a series is active
  React.useEffect(() => {
    if (!activeSeriesId) {
      setCollabs([]);
      setLinkUrl(null);
      return;
    }
    (async () => {
      setCollabLoading(true);
      setCollabErr(null);
      try {
        const rows = await listSeriesCollaborators(activeSeriesId);
        setCollabs(rows);
      } catch (e: any) {
        setCollabErr(e?.message ?? 'Failed to load collaborators');
      } finally {
        setCollabLoading(false);
      }
    })();
  }, [activeSeriesId]);

  function setDraft(qid: string, text: string) {
    setDrafts((prev) => ({ ...prev, [qid]: text }));
  }

  async function onSaveAnswer(qid: string) {
    const text = (drafts[qid] ?? '').trim();
    if (!text) return;
    setSavingQ(qid);
    setErrQ((prev) => ({ ...prev, [qid]: '' }));
    try {
      const saved = await saveMyAnswer(qid, text);
      setMyAnswers((prev) => ({ ...prev, [qid]: saved }));
    } catch (e: any) {
      setErrQ((prev) => ({ ...prev, [qid]: e?.message ?? 'Failed to save' }));
    } finally {
      setSavingQ(null);
    }
  }

  async function onDeleteAnswer(qid: string) {
    const cur = myAnswers[qid];
    if (!cur) return;
    setSavingQ(qid);
    setErrQ((prev) => ({ ...prev, [qid]: '' }));
    try {
      await deleteMyAnswer(cur.id);
      setMyAnswers((prev) => {
        const { [qid]: _, ...rest } = prev;
        return rest;
      });
      setDrafts((prev) => ({ ...prev, [qid]: '' }));
    } catch (e: any) {
      setErrQ((prev) => ({ ...prev, [qid]: e?.message ?? 'Failed to delete' }));
    } finally {
      setSavingQ(null);
    }
  }

  async function onInviteEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSeriesId || !invEmail.trim()) return;
    setCollabWorking(true);
    setCollabErr(null);
    try {
      await inviteStudyByEmail(activeSeriesId, invEmail.trim(), invRole);
      setInvEmail('');
      const rows = await listSeriesCollaborators(activeSeriesId);
      setCollabs(rows);
    } catch (err: any) {
      setCollabErr(err?.message ?? 'Invite failed');
    } finally {
      setCollabWorking(false);
    }
  }

  async function onCreateLink() {
    if (!activeSeriesId) return;
    setCollabWorking(true);
    setCollabErr(null);
    try {
      const { url } = await createStudyInviteLink(activeSeriesId, linkRole);
      setLinkUrl(url);
      await navigator.clipboard.writeText(url);
    } catch (err: any) {
      setCollabErr(err?.message ?? 'Could not create link');
    } finally {
      setCollabWorking(false);
    }
  }

  function gotoSeries(seriesId: string | null) {
    const base = `#/group/${groupId}/study`;
    if (!seriesId) {
      window.location.hash = base;
    } else {
      window.location.hash = `${base}?series=${seriesId}`;
    }
  }

  return (
    <div className="space-y-4">
      {/* Header / actions */}
      <div className="rounded-2xl border p-4 bg-white mb-1">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">Study</div>
          <div className="flex items-center gap-2">
            {/* Actions (no wrapper button here!) */}
            <GenerateStudyModal groupId={groupId} />
            {activeSeriesId ? <ExportStudyButton seriesId={activeSeriesId} /> : null}
          </div>
        </div>
      </div>

      {/* Either series list, or a specific series view */}
      {!activeSeriesId ? (
        <div className="rounded-2xl border p-4 bg-white">
          <div className="text-sm font-semibold mb-2">Your study series</div>
          {loadingSeries && <div className="text-sm opacity-60">Loading…</div>}
          {seriesErr && <div className="text-sm text-red-600">{seriesErr}</div>}
          {!loadingSeries && !seriesErr && series.length === 0 && (
            <div className="text-sm opacity-70">No study series yet. Generate one to get started.</div>
          )}

          <div className="grid gap-3 mt-2">
            {series.map((s) => (
              <div key={s.id} className="rounded-xl border p-3 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{s.title}</div>
                    <div className="text-xs opacity-70">
                      {new Date(s.created_at).toLocaleDateString()} • {s.visibility}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="text-sm rounded-lg border px-3 py-1.5"
                      onClick={() => gotoSeries(s.id)}
                    >
                      Open
                    </button>
                  </div>
                </div>
                {s.description && (
                  <div className="text-sm opacity-80 mt-2 whitespace-pre-wrap">{s.description}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border p-4 bg-white">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-sm font-semibold">Series</div>
            <div className="flex items-center gap-2">
              <button
                className="text-sm underline"
                onClick={() => gotoSeries(null)}
              >
                ← Back to all series
              </button>
            </div>
          </div>

          {/* Collaborators (inline) */}
          <div className="rounded-xl border p-3 bg-white mb-3">
            <div className="text-sm font-semibold mb-2">Collaborators</div>

            {collabErr && <div className="text-sm text-red-600 mb-2">{collabErr}</div>}
            {collabLoading ? (
              <div className="text-sm opacity-70">Loading…</div>
            ) : (
              <>
                <div className="text-xs font-medium opacity-70 mb-1">Current</div>
                <div className="grid gap-2 mb-3">
                  {collabs.length === 0 ? (
                    <div className="text-sm opacity-70">No collaborators yet.</div>
                  ) : (
                    collabs.map((c) => (
                      <div key={c.user_id} className="flex items-center justify-between rounded-lg border p-2">
                        <div className="text-sm">
                          {c.display_name || c.email || c.user_id}
                          <span className="ml-2 text-xs opacity-70">({c.role})</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Invite by email */}
                <form onSubmit={onInviteEmail} className="grid gap-2 mb-3">
                  <div className="text-xs font-medium opacity-70">Invite by email</div>
                  <div className="flex items-center gap-2">
                    <input
                      className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
                      placeholder="name@example.com"
                      value={invEmail}
                      onChange={(e) => setInvEmail(e.target.value)}
                    />
                    <select
                      className="border rounded-lg px-2 py-1.5 text-sm"
                      value={invRole}
                      onChange={(e) => setInvRole(e.target.value as 'viewer' | 'editor')}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </select>
                    <button
                      type="submit"
                      className="text-sm rounded-lg border px-3 py-1.5"
                      disabled={collabWorking || !invEmail.trim()}
                    >
                      Invite
                    </button>
                  </div>
                </form>

                {/* Create invite link */}
                <div className="grid gap-2">
                  <div className="text-xs font-medium opacity-70">Create invite link</div>
                  <div className="flex items-center gap-2">
                    <select
                      className="border rounded-lg px-2 py-1.5 text-sm"
                      value={linkRole}
                      onChange={(e) => setLinkRole(e.target.value as 'viewer' | 'editor')}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </select>
                    <button
                      className="text-sm rounded-lg border px-3 py-1.5"
                      onClick={onCreateLink}
                      disabled={collabWorking}
                    >
                      Create link
                    </button>
                    {linkUrl && (
                      <div className="text-xs opacity-80">
                        Copied: <span className="ml-1 underline">{linkUrl}</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {loadingEntries && <div className="text-sm opacity-60">Loading…</div>}
          {entriesErr && <div className="text-sm text-red-600">{entriesErr}</div>}

          {!loadingEntries && !entriesErr && entries.length === 0 && (
            <div className="text-sm opacity-70">This series has no entries yet.</div>
          )}

          {/* Entries */}
          <div className="grid gap-4">
            {entries.map((e, idx) => {
              const weekNum = e.position ?? idx + 1;
              return (
                <div key={e.id} className="rounded-xl border p-3 bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">
                        Week {weekNum}
                        {e.title ? ` — ${e.title}` : ''}
                      </div>
                      {e.focus_ref && (
                        <div className="text-xs opacity-70 mt-0.5">Focus: {e.focus_ref}</div>
                      )}
                    </div>
                  </div>

                  {e.content && (
                    <div className="text-sm mt-2 whitespace-pre-wrap">{e.content}</div>
                  )}

                  {/* Questions */}
                  {e.questions?.length ? (
                    <div className="mt-3">
                      <div className="text-sm font-medium mb-1">Discussion Questions</div>
                      <div className="grid gap-2">
                        {e.questions.map((q, qi) => {
                          const qnum = q.position ?? qi + 1;
                          const open = !!showAI[q.id];
                          return (
                            <div key={q.id} className="rounded-lg border p-2 bg-white">
                              <div className="text-sm font-medium">
                                Q{qnum}. {q.prompt ?? ''}
                              </div>
                              {q.content && (
                                <div className="text-sm opacity-80 mt-1 whitespace-pre-wrap">
                                  {q.content}
                                </div>
                              )}

                              {/* AI answer toggle */}
                              {q.ai_answer ? (
                                <div className="mt-2">
                                  <button
                                    className="text-xs underline"
                                    onClick={() =>
                                      setShowAI((prev) => ({ ...prev, [q.id]: !prev[q.id] }))
                                    }
                                  >
                                    {open ? 'Hide AI answer' : 'Show AI answer'}
                                  </button>
                                  {open && (
                                    <div className="mt-1 text-sm bg-gray-50 border rounded p-2 whitespace-pre-wrap">
                                      {q.ai_answer}
                                    </div>
                                  )}
                                </div>
                              ) : null}

                              {/* --- My Answer --- */}
                              <div className="mt-2 rounded-lg border bg-white p-2">
                                <div className="text-xs font-medium opacity-70 mb-1">My Answer</div>
                                <textarea
                                  className="w-full text-sm border rounded-md p-2"
                                  rows={3}
                                  placeholder="Write your answer…"
                                  value={drafts[q.id] ?? ''}
                                  onChange={(e) => setDraft(q.id, e.target.value)}
                                />
                                <div className="mt-2 flex items-center gap-2">
                                  <button
                                    className="text-sm rounded-lg border px-3 py-1.5"
                                    disabled={savingQ === q.id || !(drafts[q.id] ?? '').trim()}
                                    onClick={() => onSaveAnswer(q.id)}
                                  >
                                    {myAnswers[q.id]?.id ? 'Update' : 'Save'}
                                  </button>
                                  {myAnswers[q.id]?.id && (
                                    <button
                                      className="text-sm rounded-lg border px-3 py-1.5"
                                      disabled={savingQ === q.id}
                                      onClick={() => onDeleteAnswer(q.id)}
                                    >
                                      Delete
                                    </button>
                                  )}
                                  {savingQ === q.id && (
                                    <span className="text-xs opacity-70">Saving…</span>
                                  )}
                                  {!!(errQ[q.id]?.length) && (
                                    <span className="text-xs text-red-600">{errQ[q.id]}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
