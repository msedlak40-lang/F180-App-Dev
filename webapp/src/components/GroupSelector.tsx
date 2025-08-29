import React from 'react';
import { supabase } from '../lib/supabaseClient';
import { listMyGroups, type MyGroup } from '../services/groups';

export default function GroupSelector({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (groupId: string | null) => void;
}) {
  const [groups, setGroups] = React.useState<MyGroup[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listMyGroups();
      setGroups(rows);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  // Refresh when auth state changes (e.g., sign-in/out)
  React.useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });
    return () => sub.subscription?.unsubscribe?.();
  }, [load]);

  return (
    <div className="rounded-2xl border p-2 bg-white flex items-center gap-2 flex-wrap">
      <div className="text-sm font-medium">Your groups</div>

      <select
        className="border rounded-lg px-2 py-1.5 text-sm min-w-[220px]"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={loading}
        title="Select one of your groups"
      >
        <option value="">{loading ? 'Loading…' : '(choose a group)'}</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {(g.name || 'Untitled group') +
              (g.status === 'pending' ? ' (Pending approval)' : '')}
          </option>
        ))}
      </select>

      <button className="text-sm underline" onClick={load} disabled={loading}>
        {loading ? 'Refreshing…' : 'Refresh'}
      </button>

      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  );
}
