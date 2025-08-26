import React from 'react';
import { listMyGroups, type MyGroup } from '../services/groups';
import { useToast } from './ToastProvider';

export default function GroupSelector({
  value, onChange,
}: { value?: string; onChange: (id: string) => void }) {
  const [groups, setGroups] = React.useState<MyGroup[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { show } = useToast();

React.useEffect(() => {
  (async () => {
    try {
      setLoading(true);
      const rows = await listMyGroups();
      setGroups(rows);

      const ids = rows.map(r => r.group_id);
      // if no value or value isn’t one of my groups, pick the first
      if (!value || !ids.includes(value)) onChange(rows[0]?.group_id ?? '');
      if (rows.length === 0) show('You are not a member of any groups yet.', 'info');
    } catch (e:any) {
      setError(e?.message ?? 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  })();
}, []); // eslint-disable-line

  if (loading) return <div className="text-sm opacity-70">Loading groups…</div>;
  if (error) return <div className="text-sm text-red-600">{error}</div>;

  if (groups.length === 0) {
    return <div className="text-sm opacity-70">No groups yet. Ask an admin to add you.</div>;
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm opacity-70">My Groups</label>
      <select
        className="rounded-xl border px-3 py-2"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        {groups.map(g => (
          <option key={g.group_id} value={g.group_id}>
            {g.name} {g.role === 'leader' ? '(leader)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
