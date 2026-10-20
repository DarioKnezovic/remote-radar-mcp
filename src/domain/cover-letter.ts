import { isEuCountry } from './countries.js';
import type { Job } from './job.js';
import type { MatchResult } from './match.js';
import type { Profile } from './profile.js';
import { canonicalSkill } from './skills.js';
import { foldText, htmlToText, truncate } from './text.js';

export interface CoverLetterInput {
  job: Job;
  profile: Profile;
  fit: MatchResult;
}

type Story = Profile['stories'][number];

/** Placeholders the user must replace, in brackets so they stand out. */
export const NAME_PLACEHOLDER = '[Your name]';
export const STORY_PLACEHOLDER =
  '[Add one example of something you built or improved, ideally with a result, e.g. "cut page load time in half".]';

const LISTING_MAX = 6000;

function list(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1) ?? ''}`;
}

function sentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

const skillKey = (skill: string) => foldText(canonicalSkill(skill) ?? skill);

/**
 * The achievement that fits the job best: the one sharing the most skills with what the
 * listing mentions. Ties go to the first one in the profile.
 */
export function pickStory(profile: Profile, fit: MatchResult): Story | undefined {
  const mentioned = new Set(
    [...fit.matched_skills.map((m) => m.skill), ...fit.missing_skills].map(skillKey),
  );
  let best: Story | undefined;
  let bestScore = -1;
  for (const story of profile.stories) {
    const score = story.skills.filter((skill) => mentioned.has(skillKey(skill))).length;
    if (score > bestScore) {
      best = story;
      bestScore = score;
    }
  }
  return best;
}

function hasEuCitizenship(profile: Profile): boolean {
  return profile.citizenship.some((code) => isEuCountry(code));
}

/** Scopes where "I can work in the EU without a visa" is worth saying. */
function isEuropeanRole(job: Job): boolean {
  return (
    job.remote_scope === 'Europe' ||
    job.remote_scope === 'EU only' ||
    (job.remote_scope === 'Multi-region' && /\b(?:europe|emea|eu)\b/i.test(job.location ?? ''))
  );
}

/**
 * A first draft of a cover letter, built only from the profile and the fit check: nothing
 * invented. Skills marked "learning" are never claimed as experience. Missing details
 * become [bracketed] placeholders. The user edits it and sends it themselves.
 */
export function draftCoverLetter({ job, profile, fit }: CoverLetterInput): string {
  const experienced = fit.matched_skills.filter((m) => m.level !== 'learning').map((m) => m.skill);
  const learning = fit.matched_skills.filter((m) => m.level === 'learning').map((m) => m.skill);
  const mentionedTotal = fit.matched_skills.length + fit.missing_skills.length;
  const coreOfStack =
    experienced.length >= 2 && mentionedTotal > 0 && experienced.length / mentionedTotal >= 0.6;

  // Opening: the role, experience and the skills that matter for this job.
  const skills = (experienced.length > 0 ? experienced : profile.skills.strong).slice(0, 4);
  const years =
    profile.years_experience !== null && profile.years_experience > 0
      ? ` with ${profile.years_experience} years of professional experience`
      : '';
  const opening = [
    `I'm applying for the ${job.title} role at ${job.company}.`,
    ` I'm a software developer${years}`,
    skills.length > 0 ? `, working mostly with ${list(skills)}` : '',
    coreOfStack ? ', the core of the stack in your listing.' : '.',
    learning.length > 0 ? ` I'm currently learning ${list(learning)} as well.` : '',
  ].join('');

  // An example: the best-fitting achievement, or a placeholder to fill in.
  const story = pickStory(profile, fit);
  const example = story
    ? `One example of my work: ${sentence(story.title)} ${sentence(story.summary)}`
    : STORY_PLACEHOLDER;

  // Where and how they'd work: relevant for every remote role.
  const { city, country, timezone } = profile.location;
  const place = city ? `${city}, ${country}` : country;
  const remote = [
    `I work remotely from ${place} (${timezone}).`,
    hasEuCitizenship(profile) && isEuropeanRole(job) && !isEuCountry(profile.location.country_code)
      ? ' I hold EU citizenship, so I can work for companies in the EU without a visa or sponsorship.'
      : '',
  ].join('');

  return [
    `Dear ${job.company} team,`,
    opening,
    example,
    remote,
    `I'd welcome the chance to talk about how I could help ${job.company}. Thank you for your time.`,
    `Best regards,\n${profile.name ?? NAME_PLACEHOLDER}`,
  ].join('\n\n');
}

/**
 * A prompt for Claude (or any assistant) to polish the draft, with everything it needs:
 * the listing, the profile and the fit check. Ends with a heading under which the current
 * draft goes, so a page can append the user's latest edits.
 */
export function coverLetterPromptIntro({ job, profile, fit }: CoverLetterInput): string {
  const lines = (items: readonly string[]) => (items.length > 0 ? items.join(', ') : 'none');
  const stories = profile.stories.map(
    (s) => `- ${s.title}: ${s.summary}${s.skills.length > 0 ? ` (${s.skills.join(', ')})` : ''}`,
  );
  return [
    'Please help me improve this cover letter for a job I will apply to myself.',
    '',
    'Rules: stay truthful. Only use experience from my profile below; never invent skills, numbers, employers or projects. Keep it under 250 words, friendly and specific to this job, in English. Keep any [bracketed] placeholders for me to fill in. Reply with the letter only.',
    '',
    '## The job',
    `${job.title} at ${job.company}`,
    ...(job.location ? [`Location: ${job.location}`] : []),
    `Listing: ${job.url}`,
    '',
    truncate(htmlToText(job.description), LISTING_MAX),
    '',
    '## About me',
    `Lives in: ${profile.location.city ? `${profile.location.city}, ` : ''}${profile.location.country} (${profile.location.timezone})`,
    `Citizenship: ${profile.citizenship.join(', ')}`,
    ...(profile.years_experience !== null ? [`Experience: ${profile.years_experience} years`] : []),
    `Strong skills: ${lines(profile.skills.strong)}`,
    `Some experience: ${lines(profile.skills.some)}`,
    `Learning: ${lines(profile.skills.learning)}`,
    `Languages: ${lines(profile.languages)}`,
    ...(profile.looking_for.roles.length > 0
      ? [`Looking for: ${profile.looking_for.roles.join(', ')}`]
      : []),
    ...(stories.length > 0 ? ['Achievements:', ...stories] : []),
    '',
    '## Automatic fit check',
    `Skills I have that the listing mentions: ${lines(fit.matched_skills.map((m) => `${m.skill} (${m.level})`))}`,
    `Skills the listing mentions that I don't have: ${lines(fit.missing_skills)}`,
    ...(fit.red_flags.length > 0
      ? ['Warnings:', ...fit.red_flags.map((flag) => `- ${flag.message}`)]
      : []),
    '',
    '## My current draft',
    '',
  ].join('\n');
}
