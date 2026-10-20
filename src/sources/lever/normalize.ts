import { z } from 'zod';
import { employmentTypeFromLabels } from '../../domain/employment.js';
import { makeJobId, type Job } from '../../domain/job.js';
import { looksRemote, remoteScopeFor } from '../../domain/remote-scope.js';
import type { Board } from '../board-source.js';
import {
  formatSalaryRange,
  normalizeTags,
  splitTitle,
  textOrNull,
  toIsoUtc,
} from '../normalize-helpers.js';
import { leverPostingSchema, type LeverPosting } from './schema.js';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Lever splits a posting into opening/body, titled lists ("What you'll do") and a closing. */
function fullDescription(raw: LeverPosting): string {
  const lists = (raw.lists ?? []).map(
    (list) => `<h3>${escapeHtml(list.text.trim())}</h3><ul>${list.content}</ul>`,
  );
  return [raw.description ?? '', ...lists, raw.additional ?? ''].filter(Boolean).join('\n');
}

export function normalizeLeverPosting(raw: LeverPosting, board: Board): Job {
  const sourceJobId = `${board.board}:${raw.id}`;
  const categories = raw.categories ?? {};
  const allLocations = categories.allLocations ?? [];
  const { title, extra } = splitTitle(raw.text);
  const location =
    textOrNull(allLocations.length > 1 ? allLocations.join('; ') : categories.location) ?? extra;
  const workplace = (raw.workplaceType ?? 'unspecified').toLowerCase().replace('-', '');
  const isRemote = workplace === 'remote' || (workplace === 'unspecified' && looksRemote(location));
  return {
    id: makeJobId('lever', sourceJobId),
    source: 'lever',
    source_job_id: sourceJobId,
    url: raw.hostedUrl,
    title,
    company: board.company,
    location,
    remote_scope: remoteScopeFor(isRemote, location, title, raw.country),
    employment_type: employmentTypeFromLabels([categories.commitment, title]),
    salary: raw.salaryRange ? formatSalaryRange(raw.salaryRange) : null,
    tags: normalizeTags([categories.team ?? '', categories.department ?? '']),
    description: fullDescription(raw),
    published_at: toIsoUtc(raw.createdAt / 1000),
  };
}

export function normalizeLeverResponse(payload: unknown, board: Board) {
  const rawPostings = z.array(z.unknown()).parse(payload);
  const jobs: Job[] = [];
  for (const rawPosting of rawPostings) {
    const parsed = leverPostingSchema.safeParse(rawPosting);
    if (parsed.success) jobs.push(normalizeLeverPosting(parsed.data, board));
  }
  return { jobs, skipped: rawPostings.length - jobs.length };
}
