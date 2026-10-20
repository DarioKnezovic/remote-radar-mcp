import { z } from 'zod';
import { employmentTypeFromLabels } from '../../domain/employment.js';
import { makeJobId, type Job } from '../../domain/job.js';
import { looksRemote, remoteScopeFor } from '../../domain/remote-scope.js';
import { decodeHtmlEntities } from '../../domain/text.js';
import type { Board } from '../board-source.js';
import { normalizeTags, splitTitle, textOrNull, toIsoUtc } from '../normalize-helpers.js';
import { greenhouseJobSchema, type GreenhouseJob } from './schema.js';

function employmentLabels(raw: GreenhouseJob): string[] {
  const fromMetadata = (raw.metadata ?? [])
    .filter((field) => /employment|commitment|time type|contract/i.test(field.name))
    .map((field) => (typeof field.value === 'string' ? field.value : ''));
  return [...fromMetadata, raw.title];
}

export function normalizeGreenhouseJob(raw: GreenhouseJob, board: Board): Job {
  const sourceJobId = `${board.board}:${String(raw.id)}`;
  const { title, extra } = splitTitle(raw.title);
  const location = textOrNull(raw.location?.name) ?? extra;
  return {
    id: makeJobId('greenhouse', sourceJobId),
    source: 'greenhouse',
    source_job_id: sourceJobId,
    url: raw.absolute_url,
    title,
    company: board.company,
    location,
    remote_scope: remoteScopeFor(looksRemote(location), location, title),
    employment_type: employmentTypeFromLabels(employmentLabels(raw)),
    // Pay ranges are only on the single-job endpoint; one request per job isn't worth it.
    salary: null,
    tags: normalizeTags((raw.departments ?? []).map((department) => department.name)),
    description: decodeHtmlEntities(raw.content ?? ''),
    published_at: toIsoUtc(raw.first_published ?? raw.updated_at),
  };
}

export function normalizeGreenhouseResponse(payload: unknown, board: Board) {
  const { jobs: rawJobs } = z.object({ jobs: z.array(z.unknown()) }).parse(payload);
  const jobs: Job[] = [];
  for (const rawJob of rawJobs) {
    const parsed = greenhouseJobSchema.safeParse(rawJob);
    if (!parsed.success) continue;
    try {
      jobs.push(normalizeGreenhouseJob(parsed.data, board));
    } catch {
      // Unparseable date — skip the listing.
    }
  }
  return { jobs, skipped: rawJobs.length - jobs.length };
}
