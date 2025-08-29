import React from 'react';
import { supabase } from '../../lib/supabaseClient';

type J = {
  id: string;
  group_id: string;
  author_id: string;
  scripture_reference: string | null;
  soap_scripture: string | null;
  soap_observation: string | null;
  soap_application: string | null;
  soap_prayer: string | null;
  visibility: 'group' | 'leaders' | 'private';
  created_at: string;
};

export default function JournalTab({ groupId }: { groupId: string }) {
  const [rows, setRows] = React.useState<J[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('journals')
        .select(
          [
            'id',
            'group_id',
            'author_id',
            'scripture_reference',
            'soap_scripture',
            'soap_observation',
            'soap_application',
            'soap_prayer',
            'visibility',
            'created_at',
          ].join(', ')
        )
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRows((data ?? []) as J[]);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load journal');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    load();
  }, [groupId]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border p-4 bg-white flex items-center justify-between">
        <div className="text-sm font-medium">Journal</div>
        <button className="text-sm underline" onClick={load}>
          Refresh
        </button>
      </div>

      {loading && <div className="text-sm opacity-70">Loading…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {!loading && !error && rows.length === 0 && (
        <div className="rounded-2xl border p-4 bg-white text-sm opacity-80">No entries yet.</div>
      )}

      <ul className="space-y-3">
        {rows.map((j) => (
          <li key={j.id} className="rounded-2xl border p-4 bg-white">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">
                {j.scripture_reference || 'Journal Entry'}
              </div>
              <div className="text-[11px] opacity-60">
                {new Date(j.created_at).toLocaleString()} • {j.visibility}
              </div>
            </div>

            {/* SOAP sections (only show if there’s content) */}
            <div className="mt-3 grid gap-3">
              {j.soap_scripture && (
                <section className="rounded-xl border bg-gray-50 p-3">
                  <div className="text-xs font-semibold mb-1">Scripture</div>
                  <div className="text-sm whitespace-pre-wrap">{j.soap_scripture}</div>
                </section>
              )}
              {j.soap_observation && (
                <section className="rounded-xl border p-3">
                  <div className="text-xs font-semibold mb-1">
                    Observation <span className="opacity-60">(I Believe)</span>
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{j.soap_observation}</div>
                </section>
              )}
              {j.soap_application && (
                <section className="rounded-xl border p-3">
                  <div className="text-xs font-semibold mb-1">
                    Application <span className="opacity-60">(I Will)</span>
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{j.soap_application}</div>
                </section>
              )}
              {j.soap_prayer && (
                <section className="rounded-xl border p-3">
                  <div className="text-xs font-semibold mb-1">Prayer</div>
                  <div className="text-sm whitespace-pre-wrap">{j.soap_prayer}</div>
                </section>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
