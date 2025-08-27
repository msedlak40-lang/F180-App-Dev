import React from 'react';
import {
  // series + entries
  listSeriesForGroup,
  createSeries,
  deleteSeries,
  updateSeries,
  listEntries,
  addEntry,
  updateEntry,
  deleteEntry,
  // collaborators
  listCollaborators,
  removeCollaboratorByUser,
  // AI single-entry helper
  generateDevotion,
  // invite links (list/revoke + simple creator)
  listInvites,
  revokeInvite,
  createInviteLinkSimple,
  // capabilities
  mySeriesCapabilities,
  // multi-day generation + bulk insert + subscriptions
  generateDevotionSeries,
  bulkAddEntries,
  subscribeSeries,
  unsubscribeSeries,
  mySubscriptions,
  // types
  type GeneratedDevotion,
  type DevSeries,
  type DevEntry,
  type DevCollaborator,
  type DevotionVisibility,
  type DevInvite,
  type SeriesDraftItem,
} from '../../services/devotions';

/* ---------- Inline helper: optional AI assist for drafting single entries ---------- */
function AIHelp({
  currentTitle,
  onDraft,
}: {
  currentTitle: string;
  onDraft: (draft: GeneratedDevotion) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [notes, setNotes] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [lastRefs, setLastRefs] = React.useState<{ reference: string; text: string }[] | null>(null);

  const doGen = async (mode: 'title' | 'assist') => {
    setErr(null);
    const t = currentTitle.trim();
    if (!t) {
      setErr('Please enter a Title first.');
      return;
    }
    setBusy(true);
    try {
      const draft = await generateDevotion(mode, t, notes.trim() || undefined);
      onDraft(draft);
      setLastRefs(draft.scriptures?.length ? draft.scriptures : null);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to generate');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border bg-white/70 p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">AI help (optional)</div>
        <button className="text-sm underline" onClick={() => setOpen((s) => !s)}>
          {open ? 'Hide' : 'Show'}
        </button>
      </div>

      {open && (
        <>
          <p className="mt-1 text-sm opacity-70">
            Use AI to draft a devotional from your Title—or weave in your bullet points.
          </p>

          <label className="text-xs opacity-70 mt-2 block">Notes / Bullet points (optional)</label>
          <textarea
            className="w-full rounded-xl border px-3 py-2 text-sm"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="- a time I felt distant from God
- application around daily commute
- include James 4:8"
          />

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              className="rounded-xl border px-3 py-2 text-sm hover:shadow-sm disabled:opacity-60"
              onClick={() => doGen('title')}
              disabled={busy}
            >
              {busy ? 'Working…' : 'Generate from Title'}
            </button>
            <button
              className="rounded-xl border px-3 py-2 text-sm hover:shadow-sm disabled:opacity-60"
              onClick={() => doGen('assist')}
              disabled={busy}
            >
              {busy ? 'Working…' : 'Assist (Title + Notes)'}
            </button>
          </div>

          {err && <div className="mt-2 text-sm text-red-600">{err}</div>}

          {lastRefs && (
            <div className="mt-2 text-xs opacity-80">
              <div className="font-medium mb-1">Scriptures used:</div>
              <ul className="list-disc ml-5">
                {lastRefs.map((s, i) => (
                  <li key={i}>
                    <span className="font-medium">{s.reference}:</span> {s.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ----------------------- Subscriptions (Email/SMS) ----------------------- */
function SubscribeToggles({ seriesId }: { seriesId: string }) {
  const [subs, setSubs] = React.useState<Set<'email' | 'sms'>>(new Set());
  const [busy, setBusy] = React.useState<null | 'email' | 'sms'>(null);

  const load = async () => {
    try {
      const channels = await mySubscriptions(seriesId);
      setSubs(new Set(channels));
    } catch { /* ignore */ }
  };
  React.useEffect(() => { load(); }, [seriesId]);

  const toggle = async (ch: 'email' | 'sms') => {
    if (busy) return;
    setBusy(ch);
    try {
      if (subs.has(ch)) await unsubscribeSeries(seriesId, ch);
      else await subscribeSeries(seriesId, ch);
      await load();
    } catch (e: any) {
      alert(e?.message ?? 'Subscription failed');
    } finally {
      setBusy(null);
    }
  };

  const Pill = ({ ch, label }: { ch: 'email' | 'sms'; label: string }) => {
    const on = subs.has(ch);
    return (
      <button
        className={`text-xs rounded-full border px-2 py-1 ${on ? 'bg-blue-50 border-blue-400' : 'bg-gray-50'} disabled:opacity-60`}
        onClick={() => toggle(ch)}
        disabled={!!busy}
        title={on ? `Subscribed to ${label}` : `Subscribe to ${label}`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex items-center gap-2">
      <Pill ch="email" label="Email" />
      <Pill ch="sms" label="SMS" />
    </div>
  );
}

/* ------------------ Generate multi-day series (AI) panel ------------------ */
function GenerateSeriesPanel({
  seriesId,
  onInserted,
}: {
  seriesId: string;
  onInserted: () => void;
}) {
  const [open, setOpen] = React.useState(false);

  // Form
  const [theme, setTheme] = React.useState('');
  const [days, setDays] = React.useState<number>(5);
  const [start, setStart] = React.useState<string>(() => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${dd}`;
  });
  const [cadence, setCadence] = React.useState<number>(1);
  const [notes, setNotes] = React.useState('');

  // Drafts
  const [drafts, setDrafts] = React.useState<SeriesDraftItem[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const doDraft = async () => {
    if (!theme.trim()) { setErr('Enter a theme first.'); return; }
    setBusy(true); setErr(null);
    try {
      const items = await generateDevotionSeries(theme.trim(), Math.max(1, Math.min(30, days)), notes.trim() || undefined);
      setDrafts(items);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to generate');
    } finally {
      setBusy(false);
    }
  };

  const doInsert = async () => {
    if (!drafts || drafts.length === 0) return;
    setBusy(true); setErr(null);
    try {
      const count = await bulkAddEntries(seriesId, start, drafts, Math.max(1, cadence));
      alert(`Inserted ${count} entries starting ${start} (every ${cadence} day${cadence > 1 ? 's' : ''}).`);
      setDrafts(null);
      setTheme(''); setNotes(''); setDays(5); setCadence(1);
      onInserted();
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to insert entries');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border p-3 bg-white/70">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Generate multi-day series (AI)</div>
        <button className="text-sm underline" onClick={() => setOpen(s => !s)}>
          {open ? 'Hide' : 'Show'}
        </button>
      </div>

      {open && (
        <>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="sm:col-span-3">
              <label className="text-xs opacity-70">Theme</label>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder='e.g., "Identity in Christ"'
              />
            </div>
            <div>
              <label className="text-xs opacity-70">Days</label>
              <input
                type="number" min={1} max={30}
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value || '1', 10))}
              />
            </div>
            <div className="sm:col-span-4">
              <label className="text-xs opacity-70">Notes / bullet points (optional)</label>
              <textarea
                className="w-full rounded-xl border px-3 py-2 text-sm"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="- include at least one OT & one NT verse
- focus on daily application and encouragement"
              />
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <button
              className="rounded-xl border px-3 py-2 text-sm hover:shadow-sm disabled:opacity-60"
              onClick={doDraft}
              disabled={busy || !theme.trim()}
            >
              {busy ? 'Drafting…' : 'Draft series'}
            </button>
            {err && <div className="text-sm text-red-600">{err}</div>}
          </div>

          {drafts && (
            <div className="mt-3 rounded-xl border p-3 bg-white">
              <div className="text-sm font-medium">Preview ({drafts.length})</div>
              <ul className="mt-2 space-y-2">
                {drafts.map((d, i) => (
                  <li key={i} className="rounded-lg border p-2 bg-gray-50">
                    <div className="text-sm font-medium">Day {i + 1}: {d.title}</div>
                    <div className="text-xs opacity-70 mt-1 line-clamp-3">
                      {d.body_md.slice(0, 220)}{d.body_md.length > 220 ? '…' : ''}
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-xs opacity-70">Start date</label>
                  <input
                    type="date"
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs opacity-70">Cadence (days)</label>
                  <input
                    type="number" min={1}
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={cadence}
                    onChange={(e) => setCadence(parseInt(e.target.value || '1', 10))}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    className="w-full rounded-xl border px-3 py-2 text-sm hover:shadow-sm disabled:opacity-60"
                    onClick={doInsert}
                    disabled={busy || drafts.length === 0}
                  >
                    {busy ? 'Inserting…' : `Insert ${drafts.length} entries`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ----------------------- Collaborators subpanel ----------------------- */
function CollaboratorsPanel({ seriesId }: { seriesId: string }) {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<DevCollaborator[]>([]);
  const [invites, setInvites] = React.useState<DevInvite[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<'editor' | 'viewer'>('editor');
  const [busy, setBusy] = React.useState(false);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const [rows, inv] = await Promise.all([listCollaborators(seriesId), listInvites(seriesId)]);
      setItems(rows);
      setInvites(inv);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load collaborators');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const remove = async (userId: string) => {
    if (!confirm('Remove this collaborator?')) return;
    try {
      await removeCollaboratorByUser(seriesId, userId);
      await load();
    } catch (err: any) {
      alert(err?.message ?? 'Failed to remove collaborator');
    }
  };

  return (
    <div className="mt-3 rounded-xl border p-3 bg-white/70">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Collaborators</div>
        <button className="text-sm underline" onClick={() => setOpen((s) => !s)}>
          {open ? 'Hide' : 'Manage'}
        </button>
      </div>

      {open && (
        <>
          {/* Current collaborators */}
          <div className="mt-2">
            {loading && <div className="text-sm opacity-70">Loading…</div>}
            {err && <div className="text-sm text-red-600">{err}</div>}
            {!loading && items.length === 0 && (
              <div className="text-sm opacity-70">No collaborators yet.</div>
            )}
            <ul className="mt-1 divide-y">
              {items.map((c) => (
                <li key={c.user_id} className="py-2 flex items-center justify-between">
                  <div className="text-sm">
                    <div className="font-medium">{c.display_name}</div>
                    <div className="opacity-70">{c.email}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs rounded-full border px-2 py-0.5 bg-gray-50">{c.role}</span>
                    <button className="text-sm underline text-red-600" onClick={() => remove(c.user_id)}>
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Combined invite row: email (optional) + role + create link */}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
            <div>
              <label className="text-xs opacity-70">Email (optional)</label>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                placeholder="user@example.com (optional)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <div className="text-[11px] opacity-60 mt-1">
                If provided, the link can only be accepted by this email.
              </div>
            </div>
            <div>
              <label className="text-xs opacity-70">Role</label>
              <select
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div>
              <button
                className="w-full rounded-xl border px-3 py-2 text-sm hover:shadow-sm disabled:opacity-60"
                onClick={async () => {
                  if (busy) return;
                  setBusy(true);
                  try {
                    const out = await createInviteLinkSimple(seriesId, role, email.trim() || undefined);
                    const baseUrl = `${window.location.origin}/#/accept-devotion-invite`;
                    const link = `${baseUrl}?token=${encodeURIComponent(out.token)}`;
                    await navigator.clipboard?.writeText(link).catch(() => {});
                    alert(`Invite link copied:\n\n${link}\n\n${out.email_lock ? `Locked to: ${out.email_lock}` : 'Anyone can use (single use)'}`);
                    setEmail('');
                    setRole('editor');
                    await load();
                  } catch (err: any) {
                    alert(err?.message ?? 'Failed to create link');
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy}
              >
                {busy ? 'Creating…' : 'Create invite link'}
              </button>
            </div>
          </div>

          {/* Existing invite list */}
          <div className="mt-3">
            {loading && <div className="text-sm opacity-70">Loading…</div>}
            {!loading && invites.length === 0 && (
              <div className="text-sm opacity-70">No invite links yet.</div>
            )}
            <ul className="mt-1 divide-y">
              {invites.map(inv => {
                const expired = inv.expires_at && new Date(inv.expires_at) < new Date();
                const disabled = !!inv.revoked_at || expired || inv.used_count >= inv.max_uses;
                return (
                  <li key={inv.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="text-sm">
                      <div className="font-medium">Role: {inv.role}</div>
                      <div className="opacity-70">
                        {inv.email_lock ? `Locked to: ${inv.email_lock}` : 'Anyone (single use)'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="text-sm underline disabled:opacity-50"
                        onClick={async () => {
                          const url = `${window.location.origin}/#/accept-devotion-invite?token=${encodeURIComponent(inv.token)}`;
                          await navigator.clipboard?.writeText(url).catch(() => {});
                          alert('Link copied to clipboard.');
                        }}
                        disabled={disabled}
                      >
                        Copy
                      </button>
                      <button
                        className="text-sm underline text-red-600 disabled:opacity-50"
                        onClick={async () => { if (confirm('Revoke this invite?')) { await revokeInvite(inv.id); await load(); } }}
                        disabled={!!inv.revoked_at}
                      >
                        Revoke
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------- Series + Entries UI ------------------------- */
function SeriesCard({
  series,
  onChanged,
}: {
  series: DevSeries;
  onChanged: () => void;
}) {
  const [open, setOpen] = React.useState(false);

  // capabilities (hide editor-only UI)
  const [canEdit, setCanEdit] = React.useState<boolean>(false);
  const loadCaps = async () => {
    try {
      const caps = await mySeriesCapabilities(series.id);
      setCanEdit(!!caps.can_edit);
    } catch { setCanEdit(false); }
  };
  React.useEffect(() => { loadCaps(); /* also refetch on open */ }, [series.id]);
  React.useEffect(() => { if (open) loadCaps(); }, [open]); // keep in sync

  // series edit
  const [editMode, setEditMode] = React.useState(false);
  const [sTitle, setSTitle] = React.useState(series.title);
  const [sDesc, setSDesc] = React.useState(series.description ?? '');
  const [sVis, setSVis] = React.useState<DevotionVisibility>(series.visibility);
  const [savingSeries, setSavingSeries] = React.useState(false);

  // entries list
  const [loading, setLoading] = React.useState(false);
  const [entries, setEntries] = React.useState<DevEntry[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  // add entry form
  const [dayIndex, setDayIndex] = React.useState<number>(1);
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [date, setDate] = React.useState<string>('');
  const [busy, setBusy] = React.useState(false);

  // entry editing
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [eDay, setEDay] = React.useState<number>(1);
  const [eTitle, setETitle] = React.useState('');
  const [eBody, setEBody] = React.useState('');
  const [eStatus, setEStatus] = React.useState<'draft' | 'scheduled' | 'published'>('draft');
  const [eDate, setEDate] = React.useState<string>('');
  const [savingEntry, setSavingEntry] = React.useState(false);
  const [deletingEntryId, setDeletingEntryId] = React.useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const rows = await listEntries(series.id);
      setEntries(rows);
      const next = (rows[rows.length - 1]?.day_index ?? 0) + 1;
      setDayIndex(next);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load entries');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (open) { load(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const removeSeries = async () => {
    if (!confirm('Delete this series (and all its entries)?')) return;
    try {
      await deleteSeries(series.id);
      onChanged();
    } catch (e: any) {
      alert(e?.message ?? 'Failed to delete series');
    }
  };

  const startEditSeries = () => {
    setSTitle(series.title);
    setSDesc(series.description ?? '');
    setSVis(series.visibility);
    setEditMode(true);
  };

  const saveSeries = async () => {
    if (savingSeries) return;
    setSavingSeries(true);
    try {
      await updateSeries(series.id, {
        title: sTitle,
        description: sDesc,
        visibility: sVis,
      });
      setEditMode(false);
      await onChanged();
    } catch (e: any) {
      alert(e?.message ?? 'Failed to update series');
    } finally {
      setSavingSeries(false);
    }
  };

  const startEditEntry = (en: DevEntry) => {
    setEditingId(en.id);
    setEDay(en.day_index);
    setETitle(en.title);
    setEBody(en.body_md);
    setEStatus((['draft','scheduled','published'] as const).includes(en.status as any) ? (en.status as any) : 'draft');
    setEDate(en.scheduled_date ?? '');
  };

  const saveEntry = async () => {
    if (!editingId || savingEntry) return;
    setSavingEntry(true);
    try {
      await updateEntry(editingId, {
        day_index: eDay,
        title: eTitle,
        body_md: eBody,
        status: eStatus,
        scheduled_date: eDate || null,
      });
      setEditingId(null);
      await load();
    } catch (e: any) {
      alert(e?.message ?? 'Failed to update entry');
    } finally {
      setSavingEntry(false);
    }
  };

  const cancelEntryEdit = () => setEditingId(null);

  const removeEntry = async (id: string) => {
    if (deletingEntryId) return;
    if (!confirm('Delete this entry?')) return;
    setDeletingEntryId(id);
    try {
      await deleteEntry(id);
      await load();
    } catch (e: any) {
      alert(e?.message ?? 'Failed to delete entry');
    } finally {
      setDeletingEntryId(null);
    }
  };

  return (
    <div className="rounded-2xl border p-4 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          {!editMode ? (
            <>
              <div className="text-base font-semibold">{series.title}</div>
              <div className="text-sm opacity-70">
                {series.visibility === 'group'
                  ? 'Group'
                  : series.visibility === 'leaders'
                  ? 'Leaders'
                  : 'Private'}{' '}
                • {new Date(series.created_at).toLocaleDateString()}
              </div>
              {series.description && <p className="text-sm mt-2">{series.description}</p>}
            </>
          ) : (
            <div className="space-y-2">
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={sTitle}
                onChange={(e) => setSTitle(e.target.value)}
                placeholder="Series title"
              />
              <textarea
                className="w-full rounded-xl border px-3 py-2 text-sm"
                rows={3}
                value={sDesc}
                onChange={(e) => setSDesc(e.target.value)}
                placeholder="Description"
              />
              <div className="flex items-center gap-2">
                <label className="text-sm opacity-70">Visibility</label>
                <select
                  className="rounded-xl border px-3 py-2 text-sm"
                  value={sVis}
                  onChange={(e) => setSVis(e.target.value as DevotionVisibility)}
                >
                  <option value="group">Group</option>
                  <option value="leaders">Leaders</option>
                  <option value="private">Private</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {!editMode ? (
            <>
              <button className="text-sm underline" onClick={() => setOpen((s) => !s)}>
                {open ? 'Hide entries' : 'Show entries'}
              </button>

              {/* Subscriptions available to any reader */}
              <SubscribeToggles seriesId={series.id} />

              {canEdit && (
                <>
                  <button className="text-sm underline" onClick={startEditSeries}>
                    Edit
                  </button>
                  <button className="text-sm underline text-red-600" onClick={removeSeries}>
                    Delete
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <button
                className="text-sm underline"
                onClick={() => setEditMode(false)}
                disabled={savingSeries}
              >
                Cancel
              </button>
              <button
                className="text-sm underline"
                onClick={saveSeries}
                disabled={savingSeries || !sTitle.trim()}
              >
                {savingSeries ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Collaborators (editors only) */}
      {canEdit && <CollaboratorsPanel seriesId={series.id} />}

      {/* Generate multi-day (editors only) */}
      {canEdit && (
        <GenerateSeriesPanel
          seriesId={series.id}
          onInserted={async () => { await load(); }}
        />
      )}

      {/* Entries + Add */}
      {open && (
        <div className="mt-4">
          {loading && <div className="text-sm opacity-70">Loading…</div>}
          {err && <div className="text-sm text-red-600">{err}</div>}

          {/* Add entry (editors only) */}
          {canEdit && (
            <div className="rounded-xl border p-3 bg-gray-50">
              <div className="text-sm font-medium mb-2">Add Entry</div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-xs opacity-70">Day #</label>
                  <input
                    type="number"
                    min={1}
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={dayIndex}
                    onChange={(e) => setDayIndex(parseInt(e.target.value || '1', 10))}
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="text-xs opacity-70">Title</label>
                  <input
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., When God Feels Distant"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="text-xs opacity-70">Body (Markdown)</label>
                  <textarea
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    rows={6}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="~300–450 words. Include Scripture references & text."
                  />
                </div>

                <div>
                  <label className="text-xs opacity-70">Scheduled Date (optional)</label>
                  <input
                    type="date"
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
              </div>

              {/* AI help (optional) */}
              <AIHelp
                currentTitle={title}
                onDraft={(draft) => {
                  if (!title.trim() && draft.title) setTitle(draft.title);
                  setBody(draft.body_md);
                  (window as any).__aiScriptures = draft.scriptures;
                }}
              />

              <div className="mt-2">
                <button
                  className="rounded-xl border px-3 py-2 text-sm hover:shadow-sm disabled:opacity-60"
                  onClick={async () => {
                    const t = title.trim(), b = body.trim();
                    if (!t || !b || busy) return;
                    setBusy(true);
                    try {
                      const ai = (window as any).__aiScriptures as any[] | undefined;
                      await addEntry(series.id, dayIndex, t, b, {
                        status: date ? 'scheduled' : 'draft',
                        scheduled_date: date || null,
                        scriptures: Array.isArray(ai) ? ai : [],
                      });
                      setTitle(''); setBody(''); setDate('');
                      (window as any).__aiScriptures = undefined;
                      setDayIndex((d) => d + 1);
                      await load();
                    } catch (e: any) {
                      alert(e?.message ?? 'Failed to add entry');
                    } finally {
                      setBusy(false);
                    }
                  }}
                  disabled={busy || !title.trim() || !body.trim()}
                >
                  {busy ? 'Adding…' : 'Add Entry'}
                </button>
              </div>
            </div>
          )}

          {/* Entries list */}
          <div className="mt-3 space-y-3">
            {entries.map((en) => {
              const isEditing = editingId === en.id;
              return (
                <div key={en.id} className="rounded-xl border p-3 bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">
                        Day {en.day_index}: {en.title}
                      </div>
                      <div className="text-xs opacity-70">
                        {en.status}{en.scheduled_date ? ` • ${en.scheduled_date}` : ''}
                      </div>
                    </div>

                    {canEdit && !isEditing && (
                      <div className="flex items-center gap-3">
                        <button className="text-sm underline" onClick={() => startEditEntry(en)}>
                          Edit
                        </button>
                        <button
                          className="text-sm underline text-red-600 disabled:opacity-50"
                          onClick={() => removeEntry(en.id)}
                          disabled={deletingEntryId === en.id}
                        >
                          {deletingEntryId === en.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </div>

                  {!isEditing ? (
                    <div className="mt-2 text-sm whitespace-pre-wrap">{en.body_md}</div>
                  ) : (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="text-xs opacity-70">Day #</label>
                        <input
                          type="number"
                          min={1}
                          className="w-full rounded-xl border px-3 py-2 text-sm"
                          value={eDay}
                          onChange={(e) => setEDay(parseInt(e.target.value || '1', 10))}
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="text-xs opacity-70">Title</label>
                        <input
                          className="w-full rounded-xl border px-3 py-2 text-sm"
                          value={eTitle}
                          onChange={(e) => setETitle(e.target.value)}
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="text-xs opacity-70">Body (Markdown)</label>
                        <textarea
                          className="w-full rounded-xl border px-3 py-2 text-sm"
                          rows={6}
                          value={eBody}
                          onChange={(e) => setEBody(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs opacity-70">Status</label>
                        <select
                          className="w-full rounded-xl border px-3 py-2 text-sm"
                          value={eStatus}
                          onChange={(e) => setEStatus(e.target.value as any)}
                        >
                          <option value="draft">Draft</option>
                          <option value="scheduled">Scheduled</option>
                          <option value="published">Published</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs opacity-70">Scheduled Date (optional)</label>
                        <input
                          type="date"
                          className="w-full rounded-xl border px-3 py-2 text-sm"
                          value={eDate}
                          onChange={(e) => setEDate(e.target.value)}
                        />
                      </div>
                      <div className="sm:col-span-4 flex items-center gap-3">
                        <button
                          className="rounded-xl border px-3 py-2 text-sm hover:shadow-sm disabled:opacity-60"
                          onClick={saveEntry}
                          disabled={savingEntry || !eTitle.trim() || !eBody.trim()}
                        >
                          {savingEntry ? 'Saving…' : 'Save'}
                        </button>
                        <button className="text-sm underline" onClick={cancelEntryEdit}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {!loading && entries.length === 0 && (
              <div className="text-sm opacity-70">No entries yet.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------- Devotions Tab --------------------------- */
export default function DevotionsTab({ groupId }: { groupId: string }) {
  const [series, setSeries] = React.useState<DevSeries[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // create series form
  const [title, setTitle] = React.useState('');
  const [desc, setDesc] = React.useState('');
  const [vis, setVis] = React.useState<DevotionVisibility>('group');
  const [busy, setBusy] = React.useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listSeriesForGroup(groupId);
      setSeries(rows);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load series');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (groupId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const create = async () => {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await createSeries(groupId, t, desc.trim() || null, vis);
      setTitle('');
      setDesc('');
      setVis('group');
      await load();
    } catch (e: any) {
      alert(e?.message ?? 'Failed to create series');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Create series */}
      <div className="rounded-2xl border p-4 bg-white shadow-sm">
        <h2 className="text-lg font-semibold">Create a Devotional Series</h2>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="text-sm opacity-70">Title</label>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., The Father’s Heart"
            />
          </div>
          <div>
            <label className="text-sm opacity-70">Visibility</label>
            <select
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              value={vis}
              onChange={(e) => setVis(e.target.value as DevotionVisibility)}
            >
              <option value="group">Group</option>
              <option value="leaders">Leaders only</option>
              <option value="private">Private</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className="text-sm opacity-70">Description (optional)</label>
            <textarea
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              rows={3}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-3">
          <button
            className="rounded-xl border px-3 py-2 text-sm hover:shadow-sm disabled:opacity-60"
            onClick={create}
            disabled={busy || !title.trim()}
          >
            {busy ? 'Creating…' : 'Create Series'}
          </button>
        </div>
      </div>

      {/* List series */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Series</h2>
          <button className="text-sm underline" onClick={load}>
            Refresh
          </button>
        </div>

        {loading && <div className="text-sm opacity-70">Loading…</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!loading && !error && series.length === 0 && (
          <div className="rounded-2xl border p-4 bg-white text-sm opacity-80">No series yet.</div>
        )}

        {series.map((s) => (
          <SeriesCard key={s.id} series={s} onChanged={load} />
        ))}
      </div>
    </div>
  );
}
