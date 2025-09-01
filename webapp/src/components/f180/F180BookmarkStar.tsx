import React from 'react';
import { supabase } from '../../lib/supabaseClient';
import { starVerse, unstarVerse } from '../../services/library';

type Props = {
  verseId: string;
  starred?: boolean;
  onChange?: (next: boolean) => void;
};

export default function F180BookmarkStar({ verseId, starred: starredProp, onChange }: Props) {
  const isControlled = typeof starredProp === 'boolean';
  const [starredState, setStarredState] = React.useState<boolean>(!!starredProp);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => { if (isControlled) setStarredState(!!starredProp); }, [isControlled, starredProp]);

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
      if (starred) await unstarVerse(verseId);
      else await starVerse(verseId);
      if (isControlled) onChange?.(!starred);
      else setStarredState(!starred);
    } catch (e: any) {
      alert(e?.message ?? 'Failed to toggle star');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      className="text-xl transition"
      onClick={toggle}
      disabled={busy}
      aria-pressed={starred}
      aria-label={starred ? 'Unstar verse' : 'Star verse'}
      title={starred ? 'Unstar' : 'Star this verse'}
      style={{ color: starred ? 'hsl(var(--accent))' : 'hsl(var(--muted-foreground))' }}
    >
      {starred ? '★' : '☆'}
    </button>
  );
}
