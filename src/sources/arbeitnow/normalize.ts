import { employmentTypeFromLabels } from '../../domain/employment.js';
import { makeJobId, type Job } from '../../domain/job.js';
import { looksRemote, remoteScopeFor } from '../../domain/remote-scope.js';
import { normalizeTags, splitTitle, textOrNull, toIsoUtc } from '../normalize-helpers.js';
import { arbeitnowJobSchema, arbeitnowResponseSchema, type ArbeitnowJob } from './schema.js';

export function normalizeArbeitnowJob(raw: ArbeitnowJob): Job {
  const { title, extra } = splitTitle(raw.title);
  const location = textOrNull(raw.location) ?? extra;
  const isRemote = raw.remote === true || looksRemote(location);
  return {
    id: makeJobId('arbeitnow', raw.slug),
    source: 'arbeitnow',
    source_job_id: raw.slug,
    url: raw.url,
    title,
    company: raw.company_name.trim(),
    location,
    remote_scope: remoteScopeFor(isRemote, location, title),
    employment_type: employmentTypeFromLabels(raw.job_types ?? []),
    // Arbeitnow has no salary field.
    salary: null,
    tags: normalizeTags(raw.tags ?? []),
    description: raw.description ?? '',
    published_at: toIsoUtc(raw.created_at),
  };
}

export interface NormalizeResult {
  jobs: Job[];
  /** Listings that failed validation and were skipped. */
  skipped: number;
  /** URL of the next page, if any. */
  next: string | null;
}

/** Validates and normalizes one page of `/api/job-board-api`. Throws if the envelope itself is wrong. */
export function normalizeArbeitnowResponse(payload: unknown): NormalizeResult {
  const { data, links } = arbeitnowResponseSchema.parse(payload);
  const jobs: Job[] = [];
  for (const rawJob of data) {
    const parsed = arbeitnowJobSchema.safeParse(rawJob);
    if (!parsed.success) continue;
    jobs.push(normalizeArbeitnowJob(parsed.data));
  }
  return { jobs, skipped: data.length - jobs.length, next: links?.next ?? null };
}
