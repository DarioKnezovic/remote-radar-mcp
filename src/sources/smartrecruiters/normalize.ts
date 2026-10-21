import { employmentTypeFromLabels } from '../../domain/employment.js';
import { makeJobId, type Job } from '../../domain/job.js';
import { remoteScopeFor } from '../../domain/remote-scope.js';
import type { Board } from '../board-source.js';
import { normalizeTags, splitTitle, textOrNull, toIsoUtc } from '../normalize-helpers.js';
import {
  smartRecruitersListSchema,
  smartRecruitersPostingSchema,
  type SmartRecruitersPosting,
} from './schema.js';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** The job ad's sections in the order the careers page shows them, each under its own heading. */
function fullDescription(raw: SmartRecruitersPosting): string {
  const sections = raw.jobAd?.sections;
  if (!sections) return '';
  const ordered = [
    sections.companyDescription,
    sections.jobDescription,
    sections.qualifications,
    sections.additionalInformation,
  ];
  return ordered
    .filter((section) => section?.text?.trim())
    .map((section) =>
      section?.title?.trim()
        ? `<h3>${escapeHtml(section.title.trim())}</h3>\n${section.text ?? ''}`
        : (section?.text ?? ''),
    )
    .join('\n');
}

function employmentLabels(raw: SmartRecruitersPosting): (string | null | undefined)[] {
  const fromCustomFields = (raw.customField ?? [])
    .filter((field) => /employment|time type|worker type|contract/i.test(field.fieldLabel))
    .map((field) => field.valueLabel);
  return [raw.typeOfEmployment?.label, ...fromCustomFields, raw.name];
}

export function normalizeSmartRecruitersPosting(raw: SmartRecruitersPosting, board: Board): Job {
  const sourceJobId = `${board.board}:${raw.id}`;
  const { title, extra } = splitTitle(raw.name);
  const place = raw.location;
  // "Sydney, , Australia" → "Sydney, Australia".
  const fullLocation = (place?.fullLocation ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');
  const location = textOrNull(fullLocation) ?? extra;
  return {
    id: makeJobId('smartrecruiters', sourceJobId),
    source: 'smartrecruiters',
    source_job_id: sourceJobId,
    url: raw.postingUrl,
    title,
    company: board.company,
    location: place?.remote && location ? `Remote: ${location}` : location,
    remote_scope: remoteScopeFor(place?.remote === true, location, title, place?.country),
    employment_type: employmentTypeFromLabels(employmentLabels(raw)),
    // The Posting API has no salary field.
    salary: null,
    tags: normalizeTags([raw.department?.label ?? '', raw.function?.label ?? '']),
    description: fullDescription(raw),
    published_at: toIsoUtc(raw.releasedDate),
  };
}

/** Ids from a postings list page. */
export function smartRecruitersPostingIds(payload: unknown): string[] {
  return smartRecruitersListSchema.parse(payload).content.map((posting) => posting.id);
}

/** One posting's detail, or `null` when it doesn't have the fields a job needs. */
export function normalizeSmartRecruitersDetail(payload: unknown, board: Board): Job | null {
  const parsed = smartRecruitersPostingSchema.safeParse(payload);
  if (!parsed.success) return null;
  try {
    return normalizeSmartRecruitersPosting(parsed.data, board);
  } catch {
    // Unparseable date — skip the listing.
    return null;
  }
}
