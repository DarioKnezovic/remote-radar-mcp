import { z } from 'zod';
import type { Job } from './job.js';

export const APPLICATION_STATUSES = [
  'found',
  'applied',
  'interview',
  'offer',
  'rejected',
  'skipped',
] as const;
export const applicationStatusSchema = z.enum(APPLICATION_STATUSES);
export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;

/** A job the user saved, with where they are in the application process. */
export interface SavedJob {
  job: Job;
  status: ApplicationStatus;
  /** Running log, one entry per line: "[2026-10-20 applied] Sent CV via their site". */
  notes: string | null;
  saved_at: string;
  updated_at: string;
}

/**
 * Formats one notes-log entry. Notes are appended rather than replaced, so a note
 * added when saving ("referral from a former colleague") survives later status updates.
 */
export function formatNoteEntry(status: ApplicationStatus, note: string, at: Date): string {
  return `[${at.toISOString().slice(0, 10)} ${status}] ${note.trim()}`;
}
