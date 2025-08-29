import React from 'react';
import { supabase } from '../lib/supabaseClient';
import { shareSoapApplication } from '../services/accountability';

type Visibility = 'group' | 'leaders' | 'private';

export default function SoapPanel({
  groupId,
  verseId,
  verseRef,           // NEW: reference like "John 3:16"
  scripture,
  defaultOpen = false,
}: {
  groupId: string;
  verseId: string;
  verseRef: string;   // <-- make sure parent passes this
  scripture: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  // SOAP fields
  const [s, setS] = React.useState<string>(scripture ?? '');
  const [o, setO] = React.useState<string>(''); // Observation (I Believe)
  const [a, setA] = React.useState<string>(''); // Application (I Will)
  const [p, setP] = React.useState<string>(''); // Prayer

  // options
  const [vis, setVis] = React.useState<Visibility>('group');
  const [shareWithLeader, setShareWithLeader] = React.useState(false);
  const [pushToPrayers, setPushToPrayers] = React.useState(false);

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setS(scripture ?? '');
  }, [scripture]);

  async function saveJournal() {
    setSaving(true);
    setError(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error('Not signed in');

      // Insert journal entry (now includes scripture_reference)
      const { data, error } = await supabase
        .from('journals')
        .insert({
          group_id: groupId,
          author_id: uid,
          verse_id: verseId,
          scripture_reference: verseRef || null,   // <— important
          soap_scripture: s?.trim() || null,
          soap_observation: o?.trim() || null,
          soap_application: a?.trim() || null,
          soap_prayer: p?.trim() || null,
          visibility: vis,
        })
        .select('id')
        .single();

      if (error) throw error;
      const journalId = data?.id as string | undefined;

      // Share with leader (accountability inbox)
      if (shareWithLeader && a.trim()) {
        try {
          await shareSoapApplication(groupId, a.trim(), journalId ?? null);
        } catch (err: any) {
          console.warn('Share-with-leader failed:', err?.message || err);
        }
      }

      // Optional: push prayer to group_prayers
// Optional: push prayer to group_prayers via RPC (sets created_by server-side)
// Optional: push prayer to group_prayers via RPC (sets created_by server-side)
if (pushToPrayers && p.trim()) {
  try {
    const prayerVis: 'leaders' | 'private' | 'group' =
      vis === 'leaders' ? 'leaders' : vis === 'private' ? 'private' : 'group';

    const { error: gpErr } = await supabase.rpc('gp_add', {
      p_group_id: groupId,
      p_content: p.trim(),
      p_visibility: prayerVis,
    });
    if (gpErr) throw gpErr;
  } catch (err: any) {
    console.warn('Push-to-prayers failed:', err?.message || err);
  }
}

      setOpen(false);
      alert('Journal saved.');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save journal');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-white">
      <button
        className="w-full flex items-center justify-between px-4 py-2 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="font-medium">SOAP Note</div>
        <div className="text-sm opacity-70">{open ? 'Hide' : 'Show'}</div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          <div className="flex items-center gap-2">
            <label className="text-sm">Visibility:</label>
            <select
              className="border rounded-lg px-2 py-1 text-sm"
              value={vis}
              onChange={(e) => setVis(e.target.value as Visibility)}
            >
              <option value="group">Group</option>
              <option value="leaders">Leaders</option>
              <option value="private">Private</option>
            </select>
          </div>

          <div>
            <div className="text-sm font-medium">Scripture</div>
            <textarea
              className="w-full border rounded-lg p-2 text-sm bg-gray-50"
              rows={3}
              value={s}
              onChange={(e) => setS(e.target.value)}
              placeholder="(auto-filled from verse)"
            />
            <div className="text-[11px] opacity-60 mt-1">Reference: {verseRef}</div>
          </div>

          <div>
            <div className="text-sm font-medium">Observation <span className="opacity-60">(I Believe)</span></div>
            <textarea
              className="w-full border rounded-lg p-2 text-sm"
              rows={3}
              value={o}
              onChange={(e) => setO(e.target.value)}
              placeholder="What do I notice? What is true about God here?"
            />
          </div>

          <div>
            <div className="text-sm font-medium">Application <span className="opacity-60">(I Will)</span></div>
            <textarea
              className="w-full border rounded-lg p-2 text-sm"
              rows={3}
              value={a}
              onChange={(e) => setA(e.target.value)}
              placeholder="What will I do differently in response?"
            />
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={shareWithLeader}
                onChange={(e) => setShareWithLeader(e.target.checked)}
              />
              <span>Share with leader (accountability)</span>
            </label>
          </div>

          <div>
            <div className="text-sm font-medium">Prayer</div>
            <textarea
              className="w-full border rounded-lg p-2 text-sm"
              rows={3}
              value={p}
              onChange={(e) => setP(e.target.value)}
              placeholder="Write a short prayer."
            />
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={pushToPrayers}
                onChange={(e) => setPushToPrayers(e.target.checked)}
              />
              <span>Pray this with my group</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="rounded-lg px-3 py-1.5 border bg-gray-50 text-sm disabled:opacity-50"
              onClick={saveJournal}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save to Journal'}
            </button>
            {error && <div className="text-sm text-red-600">{error}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
