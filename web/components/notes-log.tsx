import { formatDate } from '@/lib/format';
import { STATUS_LABELS } from '@/lib/labels';
import { parseNotes } from '@/lib/notes';

export function NotesLog({ notes, limit }: { notes: string | null; limit?: number }) {
  const entries = parseNotes(notes);
  if (entries.length === 0) return null;
  const shown = limit ? entries.slice(-limit) : entries;
  return (
    <ul className="space-y-2 text-sm">
      {shown.map((entry, i) => (
        <li key={i}>
          <p className="text-muted text-xs">
            {entry.date ? formatDate(entry.date) : 'Note'}
            {entry.status && ` · ${STATUS_LABELS[entry.status].label}`}
          </p>
          <p className="whitespace-pre-line">{entry.text}</p>
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
