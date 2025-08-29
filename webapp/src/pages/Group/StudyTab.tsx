import React from 'react';
import {
  listSeries,
  createSeries,
  listEntries,
  addEntry,
  updateEntry,
  deleteEntry,
  listCollaborators,
  listInvites,
  createInvite,
  addQuestion,
  addAnswer,
  listQuestionsWithAnswers,
  addHighlight,
  type StudySeries,
  type StudyEntry,
  type StudyVisibility,
  type StudyCollabRole,
  type QuestionWithAnswers,
  type StudyCollaborator,
  type StudyInvite,
} from '../../services/study';
import { supabase } from '../../lib/supabaseClient';

/** Read query params from the hash (after #/route?...) */
function useHashQuery() {
  const [q, setQ] = React.useState(() => new URLSearchParams(window.location.hash.split('?')[1] || ''));
  React.useEffect(() => {
    const onHash = () => setQ(new URLSearchParams(window.location.hash.split('?')[1] || ''));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return q;
}

export default function StudyTab({ groupId }: { groupId: string }) {
  const [series, setSeries] = React.useState<StudySeries[]>([]);
  const [selSeries, setSelSeries] = React.useState<StudySeries | null>(null);
  const [entries, setEntries] = React.useState<StudyEntry[]>([]);
  const [loadingSeries, setLoadingSeries] = React.useState(true);
  const [loadingEntries, setLoadingEntries] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Create Series form
  const [showCreate, setShowCreate] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [desc, setDesc] = React.useState('');
  const [vis, setVis] = React.useState<StudyVisibility>('group');
  const [creating, setCreating] = React.useState(false);

  // Add Entry form
  const [eTitle, setETitle] = React.useState('');
  const [eRef, setERef] = React.useState('');
  const [eContent, setEContent] = React.useState('');
  const [addingEntry, setAddingEntry] = React.useState(false);

  // Collab/Invites
  const isEditor = selSeries?.my_role === 'owner' || selSeries?.my_role === 'editor';
  const [collabs, setCollabs] = React.useState<StudyCollaborator[]>([]);
  const [invites, setInvites] = React.useState<StudyInvite[]>([]);
  const [inviting, setInviting] = React.useState(false);
  const [inviteRole, setInviteRole] = React.useState<StudyCollabRole>('viewer');
  const [lastInviteUrl, setLastInviteUrl] = React.useState<string | null>(null);

  const hashQ = useHashQuery();

  // Load series for this group — IMPORTANT: no selSeries in deps to avoid loops
  const loadSeries = React.useCallback(async () => {
    setLoadingSeries(true);
    setError(null);
    try {
      const rows = await listSeries(groupId);
      setSeries(rows);
      // Keep previous selection if it still exists
      setSelSeries((prev) => (prev ? rows.find((s) => s.id === prev.id) || prev : prev));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load study series');
    } finally {
      setLoadingSeries(false);
    }
  }, [groupId]);

  // Load entries for the selected series
  const loadEntries = React.useCallback(async (seriesId: string) => {
    setLoadingEntries(true);
    setError(null);
    try {
      const rows = await listEntries(seriesId);
      setEntries(rows);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load entries');
    } finally {
      setLoadingEntries(false);
    }
  }, []);

  // Load collabs & invites (editors only)
  const loadCollabsInvites = React.useCallback(
    async (seriesId: string) => {
      try {
        if (!isEditor) {
          setCollabs([]);
          setInvites([]);
          return;
        }
        const [c, i] = await Promise.all([listCollaborators(seriesId), listInvites(seriesId)]);
        setCollabs(c);
        setInvites(i);
      } catch {
        /* ignore */
      }
    },
    [isEditor]
  );

  // On group change: reset selection and fetch series
  React.useEffect(() => {
    setSelSeries(null);
    setEntries([]);
    loadSeries();
  }, [groupId, loadSeries]);

  // Realtime: subscribe once per group/selection; avoid function deps
  React.useEffect(() => {
    const channelName = `study-rt-${groupId}-${selSeries?.id ?? 'none'}`;
    const ch = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'study_series' }, () => {
        // Any series change in this group → refresh list
        loadSeries();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'study_entries' }, (payload) => {
        // Refresh entries only if this event touches our selected series
        const sid = (payload.new as any)?.series_id ?? (payload.old as any)?.series_id;
        if (sid && sid === selSeries?.id) {
          loadEntries(sid);
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [groupId, selSeries?.id, loadSeries, loadEntries]);

  // Hash deep-link: auto-select series and scroll to entry if provided
  React.useEffect(() => {
    const sid = hashQ.get('series');
    if (!sid || series.length === 0) return;
    const s = series.find((x) => x.id === sid);
    if (!s) return;

    (async () => {
      setSelSeries(s);
      await loadEntries(s.id);
      await loadCollabsInvites(s.id);
      const eid = hashQ.get('entry');
      if (eid) {
        setTimeout(() => {
          const el = document.getElementById(`entry-${eid}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, hashQ]);

  async function handleCreateSeries(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const newId = await createSeries({
        group_id: groupId,
        title: title.trim(),
        description: desc.trim() || undefined,
        visibility: vis,
      });
      setTitle('');
      setDesc('');
      setVis('group');
      setShowCreate(false);

      // Refresh list once, then select the created series and load its data
      await loadSeries();
      // select newly created series directly via id
      const s = (await listSeries(groupId)).find((x) => x.id === newId) || null;
      if (s) {
        setSelSeries(s);
        await loadEntries(newId);
        await loadCollabsInvites(newId);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create series');
    } finally {
      setCreating(false);
    }
  }

  async function handleSelectSeries(s: StudySeries) {
    setSelSeries(s);
    await loadEntries(s.id);
    await loadCollabsInvites(s.id);
  }

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!selSeries) return;
    if (!eTitle.trim()) return;
    setAddingEntry(true);
    setError(null);
    try {
      await addEntry({
        series_id: selSeries.id,
        title: eTitle.trim(),
        focus_ref: eRef.trim() || undefined,
        content: eContent || undefined,
        position: (entries[entries.length - 1]?.position ?? 0) + 1,
      });
      setETitle('');
      setERef('');
      setEContent('');
      await loadEntries(selSeries.id);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to add entry');
    } finally {
      setAddingEntry(false);
    }
  }

  async function createInviteLink() {
    if (!selSeries) return;
    setInviting(true);
    setLastInviteUrl(null);
    try {
      const token = await createInvite(selSeries.id, inviteRole);
      const url = `${window.location.origin}/#/study-accept?token=${encodeURIComponent(token)}`;
      setLastInviteUrl(url);
      await loadCollabsInvites(selSeries.id);
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        /* ignore */
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create invite');
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border p-4 bg-white flex items-center justify-between">
        <div className="text-sm font-semibold">Study Guides</div>
        <div className="flex items-center gap-2">
          <button className="text-sm underline" onClick={loadSeries} disabled={loadingSeries}>
            {loadingSeries ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            className="rounded-lg px-3 py-1.5 border bg-gray-50 text-sm"
            onClick={() => setShowCreate((s) => !s)}
          >
            {showCreate ? 'Close' : 'New Series'}
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {/* Create Series */}
      {showCreate && (
        <form onSubmit={handleCreateSeries} className="rounded-2xl border p-4 bg-white space-y-3">
          <div className="text-sm font-medium">Create a new Study Series</div>
          <div>
            <label className="text-sm font-medium">Title</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              placeholder="e.g., Freedom in Christ"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description (optional)</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              rows={3}
              placeholder="Short purpose/overview"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Visibility</label>
            <select
              className="w-full border rounded-lg px-2 py-2 text-sm mt-1"
              value={vis}
              onChange={(e) => setVis(e.target.value as StudyVisibility)}
            >
              <option value="group">Group</option>
              <option value="leaders">Leaders</option>
              <option value="private">Private</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg px-3 py-1.5 border bg-gray-50 text-sm disabled:opacity-50"
              disabled={creating || !title.trim()}
              type="submit"
            >
              {creating ? 'Creating…' : 'Create series'}
            </button>
            <button
              type="button"
              className="text-sm underline"
              onClick={() => setShowCreate(false)}
              disabled={creating}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Series List */}
      <div className="rounded-2xl border p-4 bg-white">
        <div className="text-sm font-medium mb-3">Series in this group</div>
        {loadingSeries ? (
          <div className="text-sm opacity-70">Loading…</div>
        ) : series.length === 0 ? (
          <div className="text-sm opacity-70">
            No series yet. Create one above to get started.
          </div>
        ) : (
          <ul className="grid gap-3">
            {series.map((s) => (
              <li
                key={s.id}
                className={`rounded-xl border p-3 cursor-pointer ${selSeries?.id === s.id ? 'bg-gray-50' : 'bg-white'}`}
                onClick={() => handleSelectSeries(s)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">{s.title}</div>
                  <div className="text[11px] opacity-60">
                    {new Date(s.updated_at).toLocaleString()} • {s.visibility}
                    {s.my_role ? ` • ${s.my_role}` : ''}
                  </div>
                </div>
                {s.description && (
                  <div className="text-sm opacity-90 mt-1 whitespace-pre-wrap">{s.description}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Selected Series: Entries + Collaboration + Q&A */}
      {selSeries && (
        <div className="space-y-3">
          {/* Collaboration (owner/editor only) */}
          {isEditor && (
            <div className="rounded-2xl border p-4 bg-white">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Collaborators</div>
                <div className="flex items-center gap-2">
                  <select
                    className="border rounded-lg px-2 py-1.5 text-sm"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as StudyCollabRole)}
                    title="Role for the invite link"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>
                  <button
                    className="rounded-lg px-3 py-1.5 border bg-gray-50 text-sm disabled:opacity-50"
                    onClick={createInviteLink}
                    disabled={inviting}
                  >
                    {inviting ? 'Creating…' : 'Create invite link'}
                  </button>
                </div>
              </div>

              {lastInviteUrl && (
                <div className="mt-2 text-xs">
                  Invite URL (copied):{' '}
                  <span className="font-mono break-all">{lastInviteUrl}</span>
                </div>
              )}

              <div className="mt-3 grid gap-2">
                <div className="text-xs opacity-70">Current collaborators</div>
                {collabs.length === 0 ? (
                  <div className="text-sm opacity-70">Just you (owner).</div>
                ) : (
                  <ul className="grid gap-1">
                    {collabs.map((c) => (
                      <li key={c.user_id} className="text-sm">
                        {c.display_name || c.email || c.user_id} —{' '}
                        <span className="opacity-70">{c.role}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {invites.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs opacity-70">Recent invite links</div>
                  <ul className="grid gap-1 mt-1">
                    {invites.slice(0, 5).map((i) => (
                      <li key={i.id} className="text-xs">
                        {i.role} • {new Date(i.created_at).toLocaleString()} •{' '}
                        {i.used_at ? `used by ${i.used_by ?? 'unknown'}` : 'unused'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Entries editor */}
          <div className="rounded-2xl border p-4 bg-white">
            <div className="text-sm font-semibold">
              {selSeries.title} — Entries
            </div>
            <div className="text-xs opacity-70">
              Add lessons/parts under this series. (Highlights and Q&A below.)
            </div>

            {/* Add Entry */}
            {isEditor && (
              <form onSubmit={handleAddEntry} className="mt-3 grid gap-3">
                <div>
                  <label className="text-sm font-medium">Entry title</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                    placeholder="e.g., Romans 8: Life in the Spirit"
                    value={eTitle}
                    onChange={(e) => setETitle(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Focus scripture (optional)</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                    placeholder='e.g., "Romans 8:1–11"'
                    value={eRef}
                    onChange={(e) => setERef(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Content (optional)</label>
                  <textarea
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                    rows={5}
                    placeholder="Notes, outline, discussion starters…"
                    value={eContent}
                    onChange={(e) => setEContent(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-lg px-3 py-1.5 border bg-gray-50 text-sm disabled:opacity-50"
                    disabled={addingEntry || !eTitle.trim()}
                    type="submit"
                  >
                    {addingEntry ? 'Adding…' : 'Add entry'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Entries List with Q&A + Highlights */}
          <div className="rounded-2xl border p-4 bg-white">
            {loadingEntries ? (
              <div className="text-sm opacity-70">Loading entries…</div>
            ) : entries.length === 0 ? (
              <div className="text-sm opacity-70">No entries yet.</div>
            ) : (
              <ul className="grid gap-3">
                {entries.map((en) => (
                  <EntryCard
                    key={en.id}
                    entry={en}
                    isEditor={isEditor}
                    onChange={async (patch) => {
                      await updateEntry(en.id, patch);
                      await loadEntries(selSeries.id);
                    }}
                    onDelete={async () => {
                      if (confirm('Delete this entry?')) {
                        await deleteEntry(en.id);
                        await loadEntries(selSeries.id);
                      }
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EntryCard({
  entry,
  isEditor,
  onChange,
  onDelete,
}: {
  entry: StudyEntry;
  isEditor: boolean;
  onChange: (patch: Partial<Pick<StudyEntry, 'title' | 'content' | 'focus_ref' | 'position'>>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [edit, setEdit] = React.useState(false);
  const [title, setTitle] = React.useState(entry.title);
  const [ref, setRef] = React.useState(entry.focus_ref ?? '');
  const [content, setContent] = React.useState(entry.content ?? '');
  const [pos, setPos] = React.useState<number>(entry.position);
  const [saving, setSaving] = React.useState(false);

  // Q&A
  const [qaOpen, setQaOpen] = React.useState(false);
  const [qList, setQList] = React.useState<QuestionWithAnswers[]>([]);
  const [loadingQA, setLoadingQA] = React.useState(false);
  const [newQ, setNewQ] = React.useState('');
  const [reply, setReply] = React.useState<{ [qid: string]: string }>({});

  React.useEffect(() => {
    setTitle(entry.title);
    setRef(entry.focus_ref ?? '');
    setContent(entry.content ?? '');
    setPos(entry.position);
  }, [entry]);

  async function save() {
    setSaving(true);
    try {
      await onChange({
        title: title.trim(),
        focus_ref: ref.trim() || null,
        content,
        position: pos,
      });
      setEdit(false);
    } finally {
      setSaving(false);
    }
  }

  async function loadQA() {
    setLoadingQA(true);
    try {
      const rows = await listQuestionsWithAnswers(entry.id);
      setQList(rows);
    } finally {
      setLoadingQA(false);
    }
  }

  async function addQ() {
    if (!newQ.trim()) return;
    await addQuestion(entry.id, newQ.trim(), 'group');
    setNewQ('');
    await loadQA();
  }

  async function addA(qid: string) {
    const text = (reply[qid] ?? '').trim();
    if (!text) return;
    await addAnswer(qid, text);
    setReply((m) => ({ ...m, [qid]: '' }));
    await loadQA();
  }

  async function highlightSelection() {
    const sel = window.getSelection?.();
    const text = sel?.toString() ?? '';
    if (!text.trim()) {
      alert('Select some text in this entry first, then click Highlight.');
      return;
    }
    const note = prompt('Optional note for this highlight?') || undefined;
    await addHighlight({ entry_id: entry.id, text, loc: null, note });
    alert('Saved to your highlights. (We’ll surface Study highlights on the Library soon.)');
  }

  return (
    <li id={`entry-${entry.id}`} className="rounded-xl border p-3">
      {!edit ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">
              {entry.position}. {entry.title}
            </div>
            <div className="text-[11px] opacity-60">
              {new Date(entry.updated_at).toLocaleString()}
            </div>
          </div>
          {entry.focus_ref && <div className="text-xs opacity-80">Focus: {entry.focus_ref}</div>}
          {entry.content && <div className="text-sm whitespace-pre-wrap">{entry.content}</div>}
          <div className="flex items-center gap-2 pt-1">
            {isEditor && (
              <>
                <button className="text-sm underline" onClick={() => setEdit(true)}>
                  Edit
                </button>
                <button className="text-sm text-red-600 underline" onClick={onDelete}>
                  Delete
                </button>
              </>
            )}
            <button className="text-sm underline" onClick={highlightSelection}>
              Highlight selection
            </button>
            <button
              className="text-sm underline"
              onClick={async () => {
                setQaOpen((o) => !o);
                if (!qaOpen) await loadQA();
              }}
            >
              {qaOpen ? 'Hide discussion' : 'Open discussion'}
            </button>
          </div>

          {qaOpen && (
            <div className="mt-2 rounded-lg border p-3 bg-gray-50">
              <div className="text-sm font-semibold mb-2">Discussion</div>

              <div className="flex items-center gap-2 mb-3">
                <input
                  className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
                  placeholder="Ask a question for the group…"
                  value={newQ}
                  onChange={(e) => setNewQ(e.target.value)}
                />
                <button
                  className="text-sm rounded-lg border px-3 py-1.5"
                  onClick={addQ}
                  disabled={loadingQA || !newQ.trim()}
                >
                  Ask
                </button>
              </div>

              {loadingQA ? (
                <div className="text-sm opacity-70">Loading…</div>
              ) : qList.length === 0 ? (
                <div className="text-sm opacity-70">No questions yet.</div>
              ) : (
                <ul className="grid gap-3">
                  {qList.map((q) => (
                    <li key={q.id} className="rounded border p-2 bg-white">
                      <div className="text-sm">{q.content}</div>
                      <div className="text-[11px] opacity-60 mt-1">
                        {new Date(q.created_at).toLocaleString()}
                      </div>

                      {q.answers.length > 0 && (
                        <ul className="mt-2 grid gap-1">
                          {q.answers.map((a) => (
                            <li key={a.id} className="text-sm pl-3 border-l">
                              {a.content}
                              <div className="text-[11px] opacity-60">
                                {new Date(a.created_at).toLocaleString()}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="flex items-center gap-2 mt-2">
                        <input
                          className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
                          placeholder="Reply…"
                          value={reply[q.id] ?? ''}
                          onChange={(e) =>
                            setReply((m) => ({ ...m, [q.id]: e.target.value }))
                          }
                        />
                        <button
                          className="text-sm rounded-lg border px-3 py-1.5"
                          onClick={() => addA(q.id)}
                        >
                          Send
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-2">
          <div className="grid grid-cols-[60px_1fr] gap-2 items-center">
            <label className="text-sm opacity-70">Order</label>
            <input
              type="number"
              className="border rounded-lg px-2 py-1.5 text-sm w-24"
              value={pos}
              onChange={(e) => setPos(parseInt(e.target.value || '0', 10))}
            />
          </div>
          <div>
            <label className="text-sm opacity-70">Title</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm opacity-70">Focus scripture</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm opacity-70">Content</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg px-3 py-1.5 border bg-gray-50 text-sm disabled:opacity-50"
              onClick={save}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              className="text-sm underline"
              onClick={() => setEdit(false)}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
