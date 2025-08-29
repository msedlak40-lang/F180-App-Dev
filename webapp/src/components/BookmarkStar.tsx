import React from 'react';
import { supabase } from '../lib/supabaseClient';
import { starVerse, unstarVerse } from '../services/library';

type Props = {
  verseId: string;
  /** Controlled value; if omitted, component manages its own state */
  starred?: boolean;
  /** Called after a successful toggle when controlled */
  onChange?: (next: boolean) => void;
};

export default function BookmarkStar({ verseId, starred: starredProp, onChange }: Props) {
  const isControlled = typeof starredProp === 'boolean';
  const [starredState, setStarredState] = React.useState<boolean>(!!starredProp);
  const [busy, setBusy] = React.useState(false);

  // Keep internal state in sync when controlled
  React.useEffect(() => {
    if (isControlled) setStarredState(!!starredProp);
  }, [isControlled, starredProp]);

  // If UNcontrolled, discover initial starred status on mount
  React.useEffect(() => {
    if (isControlled) return;
    let ok = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return;
      const { data, error } = await supabase
        .from('verse_bookmarks')
        .select('verse_id')
        .eq('user_id', uid)
        .eq('verse_id', verseId)
        .limit(1);
      if (!ok) return;
      if (!error) setStarredState((data ?? []).length > 0);
    })();
    return () => { ok = false; };
  }, [isControlled, verseId]);

  const starred = isControlled ? !!starredProp : starredState;

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (starred) {
        await unstarVerse(verseId);   // server RPC (vb_unstar) fills user_id via auth.uid()
      } else {
        await starVerse(verseId);     // server RPC (vb_star)
      }
      if (isControlled) {
        onChange?.(!starred);
      } else {
        setStarredState(!starred);
      }
      // Library page will update via Realtime; our Library list also has a client-join fallback.
    } catch (e: any) {
      alert(e?.message ?? 'Failed to toggle star');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      className={`text-xl ${starred ? 'text-yellow-500' : 'text-gray-400'}`}
      title={starred ? 'Unstar' : 'Star this verse'}
      onClick={toggle}
      disabled={busy}
      aria-pressed={starred}
      aria-label={starred ? 'Unstar verse' : 'Star verse'}
    >
      {starred ? '★' : '☆'}
    </button>
  );
}
