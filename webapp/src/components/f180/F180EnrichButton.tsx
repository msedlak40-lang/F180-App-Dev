import React from 'react';
import { enrichVerse } from '../../services/verses';
import { useF180Toast } from './F180ToastProvider';

export default function F180EnrichButton({
  verseId, disabled, status, onDone,
}: { verseId: string; disabled?: boolean; status?: 'pending'|'enriching'|'enriched'|'error'; onDone?: () => void }) {
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const { show } = useF180Toast();

  const blocked = disabled || loading || status === 'enriched' || status === 'enriching';

  const click = async () => {
    if (blocked) return;
    setLoading(true); setErr(null);
    try {
      await enrichVerse(verseId);
      show('Enrichment requested. Refresh to see updates.', 'success');
      onDone?.();
    } catch (e: any) {
      const msg = e?.message ?? 'Failed to enrich';
      setErr(msg);
      show(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const label =
    status === 'enriched' ? 'Enriched ✓' :
    status === 'enriching' ? 'Enriching…' :
    loading ? 'Enriching…' : 'Enrich';

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={click}
        disabled={blocked}
        className="px-3 py-1 rounded-xl border transition hover:shadow-sm disabled:opacity-60"
        style={{
          background: 'hsl(var(--card))',
          color: 'hsl(var(--foreground))',
          borderColor: 'hsl(var(--border))',
        }}
        aria-busy={loading || status === 'enriching'}
      >
        {label}
      </button>
      {err && <span className="text-sm" style={{ color: 'hsla(0,75%,60%,1)' }}>{err}</span>}
    </div>
  );
}
