import React from 'react';
import { bookmarkVerse, unbookmarkVerse } from '../services/engagement';

export default function BookmarkStar({
  verseId,
  starred,
  onChange,
}: {
  verseId: string;
  starred: boolean;
  onChange: (next: boolean) => void;
}) {
  const [loading, setLoading] = React.useState(false);

  const toggle = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (starred) {
        await unbookmarkVerse(verseId);
        onChange(false);
      } else {
        await bookmarkVerse(verseId);
        onChange(true);
      }
    } catch (e) {
      alert((e as any)?.message ?? 'Bookmark failed');
    } finally {
      setLoading(false);
    }
  };

  // inline SVG star
  return (
    <button
      type="button"
      aria-pressed={starred}
      onClick={toggle}
      disabled={loading}
      className={`p-1 rounded-md border hover:shadow-sm disabled:opacity-60 ${starred ? 'border-yellow-300' : 'border-gray-200'}`}
      title={starred ? 'Remove bookmark' : 'Add bookmark'}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"
        className={starred ? 'fill-yellow-500' : 'fill-gray-300'}>
        <path d="M12 .587l3.668 7.431 8.2 1.193-5.934 5.787 1.401 8.168L12 18.896l-7.335 3.87 1.401-8.168L.132 9.211l8.2-1.193L12 .587z"/>
      </svg>
    </button>
  );
}
