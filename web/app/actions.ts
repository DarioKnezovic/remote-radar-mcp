'use server';

import { revalidatePath } from 'next/cache';
import { APPLICATION_STATUSES, type ApplicationStatus } from 'remote-radar-mcp/domain';
import type { ProfileIssue } from 'remote-radar-mcp/app';
import { getRadar } from '@/lib/radar';

export type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_NOTE = 2000;
const DB_ERROR = 'Couldn’t save. Is the database running?';

function validJobId(jobId: unknown): jobId is string {
  return typeof jobId === 'string' && jobId.length > 0 && jobId.length <= 300;
}

function cleanNote(note: unknown): string | undefined | false {
  if (note === undefined || note === null) return undefined;
  if (typeof note !== 'string') return false;
  const trimmed = note.trim();
  if (trimmed.length > MAX_NOTE) return false;
  return trimmed || undefined;
}

function refreshTracker() {
  revalidatePath('/tracker');
  revalidatePath('/jobs/[id]', 'page');
  revalidatePath('/');
}

/** Saves a job to "My jobs" with status "Saved". Never applies anywhere. */
export async function saveJobAction(jobId: string): Promise<ActionResult> {
  if (!validJobId(jobId)) return { ok: false, error: 'Invalid job.' };
  try {
    const radar = await getRadar();
    const result = await radar.tracker.saveJob(jobId);
    if (result.kind === 'job_not_found') {
      return { ok: false, error: 'This job is no longer available. Try searching again.' };
    }
  } catch {
    return { ok: false, error: DB_ERROR };
  }
  refreshTracker();
  return { ok: true };
}

/** Records where you are with a saved job, e.g. "applied" after you applied yourself. */
export async function updateStatusAction(
  jobId: string,
  status: ApplicationStatus,
  note?: string,
): Promise<ActionResult> {
  if (!validJobId(jobId)) return { ok: false, error: 'Invalid job.' };
  if (!APPLICATION_STATUSES.includes(status)) return { ok: false, error: 'Unknown status.' };
  const cleaned = cleanNote(note);
  if (cleaned === false) return { ok: false, error: `Notes can be up to ${MAX_NOTE} characters.` };
  try {
    const radar = await getRadar();
    const result = await radar.tracker.updateStatus(jobId, status, cleaned);
    if (result.kind === 'not_saved') return { ok: false, error: 'Save this job first.' };
  } catch {
    return { ok: false, error: DB_ERROR };
  }
  refreshTracker();
  return { ok: true };
}

/** Adds a note to a saved job without changing its status. */
export async function addNoteAction(jobId: string, note: string): Promise<ActionResult> {
  if (!validJobId(jobId)) return { ok: false, error: 'Invalid job.' };
  const cleaned = cleanNote(note);
  if (cleaned === false) return { ok: false, error: `Notes can be up to ${MAX_NOTE} characters.` };
  if (!cleaned) return { ok: false, error: 'Write a note first.' };
  try {
    const radar = await getRadar();
    // Saving an already-saved job keeps its status and appends the note.
    const result = await radar.tracker.saveJob(jobId, cleaned);
    if (result.kind === 'job_not_found') return { ok: false, error: 'This job no longer exists.' };
  } catch {
    return { ok: false, error: DB_ERROR };
  }
  refreshTracker();
  return { ok: true };
}

export type SaveProfileResult = { ok: true } | { ok: false; error: string; issues: ProfileIssue[] };

/** Validates and writes profile.json. Nothing is written if anything is invalid. */
export async function saveProfileAction(input: unknown): Promise<SaveProfileResult> {
  let result;
  try {
    const radar = await getRadar();
    result = await radar.profiles.save(input);
  } catch {
    return { ok: false, error: DB_ERROR, issues: [] };
  }
  if (!result.ok) return { ok: false, error: result.error, issues: result.issues ?? [] };
  // No revalidation needed: every page reads the profile when it renders. (Refreshing this
  // one would also swap the setup wizard for the full form before it can say "ready".)
  return { ok: true };
}
