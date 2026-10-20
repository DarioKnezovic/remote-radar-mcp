import { makeJobId, type EmploymentType, type Job } from '../../domain/job.js';
import { classifyRemoteScope } from '../../domain/remote-scope.js';
import { normalizeTags, textOrNull, toIsoUtc } from '../normalize-helpers.js';
import { remotiveJobSchema, remotiveResponseSchema, type RemotiveJob } from './schema.js';

const EMPLOYMENT_TYPES: Record<string, EmploymentType> = {
  full_time: 'full_time',
  part_time: 'part_time',
  contract: 'contract',
  freelance: 'freelance',
  internship: 'internship',
};

export function normalizeRemotiveJob(raw: RemotiveJob): Job {
  const sourceJobId = String(raw.id);
  const location = textOrNull(raw.candidate_required_location);
  return {
    id: makeJobId('remotive', sourceJobId),
    source: 'remotive',
    source_job_id: sourceJobId,
    url: raw.url,
    title: raw.title.trim(),
    company: raw.company_name.trim(),
    location,
    // Every Remotive listing is remote; the location says from where.
    remote_scope: classifyRemoteScope(location),
    employment_type: EMPLOYMENT_TYPES[raw.job_type?.trim().toLowerCase() ?? ''] ?? 'unknown',
    salary: textOrNull(raw.salary),
    tags: normalizeTags(raw.tags ?? []),
    description: raw.description ?? '',
    published_at: toIsoUtc(raw.publication_date),
  };
}

export interface NormalizeResult {
  jobs: Job[];
  /** Listings that failed validation and were skipped. */
  skipped: number;
}

/** Validates and normalizes a full `/api/remote-jobs` response. Throws if the envelope itself is wrong. */
export function normalizeRemotiveResponse(payload: unknown): NormalizeResult {
  const { jobs: rawJobs } = remotiveResponseSchema.parse(payload);
  const jobs: Job[] = [];
  for (const rawJob of rawJobs) {
    const parsed = remotiveJobSchema.safeParse(rawJob);
    if (!parsed.success) continue;
    try {
      jobs.push(normalizeRemotiveJob(parsed.data));
    } catch {
      // Unparseable date etc. — skip the listing rather than fail the feed.
    }
  }
  return { jobs, skipped: rawJobs.length - jobs.length };
}
