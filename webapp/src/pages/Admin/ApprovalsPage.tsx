import React from 'react';
import {
  adminListPendingGroups,
  adminApproveGroup,
  adminDenyGroup,
  type PendingGroup,
} from '../../services/admin';

export default function ApprovalsPage() {
  const [rows, setRows] = React.useState<PendingGroup[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // per-row UI state
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [autoAdd, setAutoAdd] = React.useState<Record<string, boolean>>({});
  const [working, setWorking] = React.useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await adminListPendingGroups();
      setRows(data);
      // init per-row defaults
      const initAuto: Record<string, boolean> = {};
      data.forEach((r) => (initAuto[r.id] = true));
      setAutoAdd(initAuto);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load pending groups');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  async function approve(id: string) {
    setWorking((m) => ({ ...m, [id]: true }));
    try {
      await adminApproveGroup(id, notes[id] ?? null, autoAdd[id] ?? true);
      await load();
    } catch (e: any) {
      alert(e?.message ?? 'Approve failed');
    } finally {
      setWorking((m) => ({ ...m, [id]: false }));
    }
  }

  async function deny(id: string) {
    setWorking((m) => ({ ...m, [id]: true }));
    try {
      await adminDenyGroup(id, notes[id] ?? null);
      await load();
    } catch (e: any) {
      alert(e?.message ?? 'Deny failed');
    } finally {
      setWorking((m) => ({ ...m, [id]: false }));
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border p-4 bg-white flex items-center justify-between">
        <div className="text-sm font-semibold">Pending Group Approvals</div>
        <button className="text-sm underline" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="rounded-2xl border p-4 bg-white">
        {loading ? (
          <div className="text-sm opacity-70">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm opacity-70">
            Nothing to review. (You may not be an org owner/admin, or there are no pending requests.)
          </div>
        ) : (
          <ul className="grid gap-3">
            {rows.map((g) => (
              <li key={g.id} className="rounded-xl border p-3 bg-gray-50">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">{g.name}</div>
                  <div className="text-[11px] opacity-60">
                    {new Date(g.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="text-xs opacity-80 mt-1">
                  Requested by:{' '}
                  {g.requested_by_name || g.requested_by_email || g.requested_by}
                </div>

                <div className="grid gap-2 mt-3">
                  <textarea
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Optional note (e.g., details, reason)…"
                    value={notes[g.id] ?? ''}
                    onChange={(e) =>
                      setNotes((m) => ({ ...m, [g.id]: e.target.value }))
                    }
                  />
                  <label className="text-sm flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={autoAdd[g.id] ?? true}
                      onChange={(e) =>
                        setAutoAdd((m) => ({ ...m, [g.id]: e.target.checked }))
                      }
                    />
                    Auto-add requester as group leader
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      className="text-sm rounded-lg border px-3 py-1.5 disabled:opacity-50"
                      disabled={working[g.id]}
                      onClick={() => approve(g.id)}
                    >
                      {working[g.id] ? 'Working…' : 'Approve'}
                    </button>
                    <button
                      className="text-sm rounded-lg border px-3 py-1.5 text-red-600 disabled:opacity-50"
                      disabled={working[g.id]}
                      onClick={() => deny(g.id)}
                    >
                      {working[g.id] ? 'Working…' : 'Deny'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
