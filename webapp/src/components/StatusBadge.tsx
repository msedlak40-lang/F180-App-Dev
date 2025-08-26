import React from 'react';
import type { VerseStatus } from '../services/verses';

export default function StatusBadge({ status }: { status: VerseStatus }) {
  const styles: Record<VerseStatus, string> = {
    pending:   'bg-yellow-100 text-yellow-800 border-yellow-200',
    enriching: 'bg-blue-100 text-blue-800 border-blue-200',
    enriched:  'bg-green-100 text-green-800 border-green-200',
    error:     'bg-red-100 text-red-800 border-red-200',
  };
  return <span className={`text-xs px-2 py-1 rounded-full border capitalize ${styles[status]}`}>{status}</span>;
}
