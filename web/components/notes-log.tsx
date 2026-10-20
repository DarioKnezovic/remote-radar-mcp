import { formatDate } from '@/lib/format';
import { STATUS_LABELS } from '@/lib/labels';
import { parseNotes } from '@/lib/notes';

export function NotesLog({ notes, limit }: { notes: string | null; limit?: number }) {
  const entries = parseNotes(notes);
  if (entries.length === 0) return null;
  const shown = limit ? entries.slice(-limit) : entries;
  return (
    <ul className="space-y-1.5 text-sm">
      {shown.map((entry, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-muted shrink-0 tabular-nums">
            {entry.date ? formatDate(entry.date) : '—'}
          </span>
          <span className="whitespace-pre-line">
            {entry.status && (
              <span className="text-muted">{STATUS_LABELS[entry.status].label}: </span>
            )}
            {entry.text}
          </span>
        </li>
      ))}
      {limit && entries.length > limit && (
        <li className="text-muted text-xs">
          + {entries.length - limit} earlier notes on the job page
        </li>
      )}
    </ul>
  );
}
