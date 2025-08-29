import React from 'react';
import { listLeaderInbox, ackItem, replyItem, type InboxItem } from '../services/accountability';
import { supabase } from '../lib/supabaseClient';

export default function LeaderInbox({ groupId }: { groupId: string }) {
  const [items, setItems] = React.useState<InboxItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [replyingId, setReplyingId] = React.useState<string | null>(null);
  const [replyText, setReplyText] = React.useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listLeaderInbox(groupId);
      setItems(rows);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load inbox');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    load();
  }, [groupId]);

  // Realtime: refresh when items/acks change for this group
  React.useEffect(() => {
    const ch = supabase
      .channel(`inbox-${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'accountability_items', filter: `group_id=eq.${groupId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'accountability_acks' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [groupId]);

  return (
    <div className="rounded-2xl border p-4 bg-white">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Leader Inbox <span className="opacity-60 text-xs">(private to leaders)</span></div>
        <button className="text-sm underline" onClick={load}>Refresh</button>
      </div>

      {loading && <div className="text-sm opacity-70 mt-2">Loading…</div>}
      {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
      {!loading && !error && items.length === 0 && (
        <div className="text-sm opacity-70 mt-2">Nothing here yet.</div>
      )}

      <ul className="mt-3 space-y-3">
        {items.map((it) => (
          <li key={it.item_id} className="rounded-xl border p-3 bg-gray-50">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm">
                <div className="font-medium">
                  {it.member_name} {it.title ? <>• <span className="opacity-80">{it.title}</span></> : null}
                </div>
                <div className="text-xs opacity-60">
                  {new Date(it.created_at).toLocaleString()} • {it.status}
                </div>
                <div className="mt-2 whitespace-pre-wrap">{it.content}</div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button
                  className="text-sm underline"
                  onClick={async () => {
                    try { await ackItem(it.item_id, 'saw_it'); } catch (e: any) { alert(e?.message ?? 'Failed'); }
                  }}
                >
                  Saw it
                </button>
                <button
                  className="text-sm underline"
                  onClick={async () => {
                    try { await ackItem(it.item_id, 'praying'); } catch (e: any) { alert(e?.message ?? 'Failed'); }
                  }}
                >
                  Praying
                </button>
                <button
                  className="text-sm underline"
                  onClick={() => {
                    setReplyingId(it.item_id);
                    setReplyText('');
                  }}
                >
                  Reply…
                </button>
              </div>
            </div>

            {/* Inline reply */}
            {replyingId === it.item_id && (
              <div className="mt-3 rounded-lg border bg-white p-2">
                <textarea
                  className="w-full border rounded-lg p-2 text-sm"
                  rows={3}
                  placeholder="Private reply to this member…"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                />
                <div className="mt-2 flex items-center gap-2 justify-end">
                  <button className="text-sm underline" onClick={() => setReplyingId(null)}>Cancel</button>
                  <button
                    className="text-sm rounded-lg px-3 py-1.5 border bg-gray-50 disabled:opacity-50"
                    disabled={!replyText.trim()}
                    onClick={async () => {
                      try {
                        await replyItem(it.item_id, replyText.trim());
                        setReplyingId(null);
                        setReplyText('');
                      } catch (e: any) {
                        alert(e?.message ?? 'Failed to send reply');
                      }
                    }}
                  >
                    Send reply
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
