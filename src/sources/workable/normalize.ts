import { z } from 'zod';
import { employmentTypeFromLabels } from '../../domain/employment.js';
import { makeJobId, type Job } from '../../domain/job.js';
import { remoteScopeFor } from '../../domain/remote-scope.js';
import type { Board } from '../board-source.js';
import { normalizeTags, remoteIn, splitTitle, textOrNull, toIsoUtc } from '../normalize-helpers.js';
import { workableJobSchema, type WorkableJob } from './schema.js';

/** "Athens, Greece; Heraklion, Greece". Remote jobs: "Remote: Brazil". */
function locationText(raw: WorkableJob, extra: string | null): string | null {
  const locations = raw.locations ?? [];
  if (raw.telecommuting)
    return remoteIn(
      locations.map((l) => l.country),
      extra ?? 'Remote',
    );
  const places = locations.map((l) =>
    [l.city, l.country]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(', '),
  );
  return textOrNull(places.filter(Boolean).join('; ')) ?? extra;
}

/** Dates come without a time ("2026-10-20"): read as midnight UTC. */
function workableDate(value: string): string {
  return toIsoUtc(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
}

export function normalizeWorkableJob(raw: WorkableJob, board: Board): Job {
  const sourceJobId = `${board.board}:${raw.shortcode}`;
  const { title, extra } = splitTitle(raw.title);
  const location = locationText(raw, extra);
  const locations = raw.locations ?? [];
  const countryCode = locations.length === 1 ? locations[0]?.countryCode : null;
  return {
    id: makeJobId('workable', sourceJobId),
    source: 'workable',
    source_job_id: sourceJobId,
    url: raw.url,
    title,
    company: board.company,
    location,
    remote_scope: remoteScopeFor(raw.telecommuting === true, location, title, countryCode),
    employment_type: employmentTypeFromLabels([raw.employment_type, title]),
    // The widget API has no salary field.
    salary: null,
    tags: normalizeTags([raw.department ?? '']),
    description: raw.description ?? '',
    published_at: workableDate(raw.published_on ?? raw.created_at),
  };
}

/**
 * A job open in several cities comes once per city, with the same shortcode and one
 * location each. They're merged into one job with all the locations.
 */
function mergeByShortcode(rawJobs: readonly WorkableJob[]): WorkableJob[] {
  const byShortcode = new Map<string, WorkableJob>();
  for (const raw of rawJobs) {
    const seen = byShortcode.get(raw.shortcode);
    byShortcode.set(
      raw.shortcode,
      seen ? { ...seen, locations: [...(seen.locations ?? []), ...(raw.locations ?? [])] } : raw,
    );
  }
  return [...byShortcode.values()];
}

export function normalizeWorkableResponse(payload: unknown, board: Board) {
  const { jobs: rawJobs } = z.object({ jobs: z.array(z.unknown()) }).parse(payload);
  const parsedJobs: WorkableJob[] = [];
  for (const rawJob of rawJobs) {
    const parsed = workableJobSchema.safeParse(rawJob);
    if (parsed.success) parsedJobs.push(parsed.data);
  }
  const merged = mergeByShortcode(parsedJobs);
  const jobs: Job[] = [];
  for (const raw of merged) {
    try {
      jobs.push(normalizeWorkableJob(raw, board));
    } catch {
      // Unparseable date — skip the listing.
    }
  }
  return {
    jobs,
    merged: parsedJobs.length - merged.length,
    skipped: rawJobs.length - parsedJobs.length + (merged.length - jobs.length),
  };
}
