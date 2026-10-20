import type { ApplicationStatus } from 'remote-radar-mcp/domain';

export interface NoteEntry {
  date: string;
  status: ApplicationStatus | undefined;
  text: string;
}

const ENTRY = /^\[(\d{4}-\d{2}-\d{2}) ([a-z_]+)\] ([\s\S]*)$/;

/**
 * The tracker keeps notes as a log, one entry per line: "[2026-10-20 applied] Sent CV".
 * Lines that don't look like that (e.g. edited by hand) are kept as plain text.
 */
export function parseNotes(notes: string | null): NoteEntry[] {
  if (!notes) return [];
  const entries: NoteEntry[] = [];
  for (const line of notes.split('\n')) {
    const match = ENTRY.exec(line);
    if (match) {
      entries.push({
        date: match[1] ?? '',
        status: match[2] as ApplicationStatus,
        text: match[3] ?? '',
      });
    } else if (line.trim()) {
      const last = entries.at(-1);
      if (last) last.text += `\n${line}`;
      else entries.push({ date: '', status: undefined, text: line });
    }
  }
  return entries;
}
