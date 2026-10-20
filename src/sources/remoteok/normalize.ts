import { z } from 'zod';
import { employmentTypeFromLabels } from '../../domain/employment.js';
import { makeJobId, type Job } from '../../domain/job.js';
import { remoteScopeFor } from '../../domain/remote-scope.js';
import {
  formatSalaryRange,
  normalizeTags,
  splitTitle,
  textOrNull,
  toIsoUtc,
} from '../normalize-helpers.js';
import { remoteOkJobSchema, type RemoteOkJob } from './schema.js';

export function normalizeRemoteOkJob(raw: RemoteOkJob): Job {
  const sourceJobId = String(raw.id);
  const { title, extra } = splitTitle(raw.position);
  const location = textOrNull(raw.location) ?? extra;
  const tags = normalizeTags(raw.tags ?? []);
  const published = raw.date ?? raw.epoch;
  if (published === null || published === undefined) throw new Error('missing date');
  return {
    id: makeJobId('remoteok', sourceJobId),
    source: 'remoteok',
    source_job_id: sourceJobId,
    url: raw.url,
    title,
    company: raw.company.trim(),
    location,
    // Remote OK only lists remote jobs; the location narrows where from.
    remote_scope: remoteScopeFor(true, location, title),
    employment_type: employmentTypeFromLabels([...tags, title]),
    salary: formatSalaryRange({
      min: raw.salary_min,
      max: raw.salary_max,
      currency: 'USD',
      interval: 'per-year',
    }),
    tags,
    description: raw.description ?? '',
    published_at: toIsoUtc(published),
  };
}

export interface NormalizeResult {
  jobs: Job[];
  skipped: number;
}

export function normalizeRemoteOkResponse(payload: unknown): NormalizeResult {
  const items = z.array(z.unknown()).parse(payload);
  // The legal notice ({ last_updated, legal }) isn't a listing, so it doesn't count as skipped.
  const listings = items.filter(
    (item) => !(typeof item === 'object' && item !== null && 'legal' in item),
  );
  const jobs: Job[] = [];
  for (const item of listings) {
    const parsed = remoteOkJobSchema.safeParse(item);
    if (!parsed.success) continue;
    try {
      jobs.push(normalizeRemoteOkJob(parsed.data));
    } catch {
      // Unparseable date — skip the listing.
    }
  }
  return { jobs, skipped: listings.length - jobs.length };
}
