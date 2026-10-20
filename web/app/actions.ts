'use server';

import { revalidatePath } from 'next/cache';
import { getRadar } from '@/lib/radar';

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Saves a job to "My jobs" with status "Saved". Never applies anywhere. */
export async function saveJobAction(jobId: string): Promise<ActionResult> {
  if (typeof jobId !== 'string' || jobId.length === 0 || jobId.length > 300) {
    return { ok: false, error: 'Invalid job.' };
  }
  try {
    const radar = await getRadar();
    const result = await radar.tracker.saveJob(jobId);
    if (result.kind === 'job_not_found') {
      return { ok: false, error: 'This job is no longer available. Try searching again.' };
    }
  } catch {
    return { ok: false, error: 'Couldn’t save. Is the database running?' };
  }
  revalidatePath('/tracker');
  revalidatePath('/');
  return { ok: true };
}
