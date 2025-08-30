import React from 'react';
import { fetchSeriesForExport } from '../services/study';

function toMd(text?: string | null) {
  return (text ?? '').replace(/\r\n/g, '\n');
}

function saveTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ExportStudyButton({ seriesId }: { seriesId: string }) {
  const [working, setWorking] = React.useState(false);

  async function exportMd() {
    if (!seriesId) return;
    setWorking(true);
    try {
      const { series, entries } = await fetchSeriesForExport(seriesId);

      const lines: string[] = [];
      lines.push(`# ${series.title}`);
      lines.push('');
      if (series.description) {
        lines.push(toMd(series.description));
        lines.push('');
      }
      lines.push(`_Created_: ${new Date(series.created_at).toLocaleDateString()}`);
      lines.push(`_Visibility_: ${series.visibility}`);
      lines.push('');

      entries.forEach((e, idx) => {
        const weekNum = e.position ?? idx + 1;
        lines.push(`## Week ${weekNum}${e.title ? ` — ${e.title}` : ''}`);
        if (e.focus_ref) lines.push(`**Focus:** ${e.focus_ref}`);
        lines.push('');
        if (e.content) {
          lines.push(toMd(e.content));
          lines.push('');
        }
        if (e.questions?.length) {
          lines.push(`### Discussion Questions`);
          e.questions.forEach((q, i) => {
            const n = q.position ?? i + 1;
            lines.push(`**Q${n}. ${q.prompt ?? ''}**`);
            if (q.content) lines.push(`- _Notes_: ${toMd(q.content)}`);
            if (q.ai_answer) lines.push(`- _AI answer (optional)_: ${toMd(q.ai_answer)}`);
            lines.push('');
          });
        }
        lines.push('');
      });

      const md = lines.join('\n');
      const safeTitle = series.title.replace(/[^a-z0-9\-_. ]/gi, '_');
      saveTextFile(`${safeTitle || 'study'}.md`, md);
    } catch (e: any) {
      alert(e?.message ?? 'Export failed');
    } finally {
      setWorking(false);
    }
  }

  return (
    <button
      className="text-sm rounded-lg border px-3 py-1.5"
      onClick={exportMd}
      disabled={working || !seriesId}
      title={!seriesId ? 'Open a series first' : 'Download as Markdown'}
    >
      {working ? 'Exporting…' : 'Export'}
    </button>
  );
}
