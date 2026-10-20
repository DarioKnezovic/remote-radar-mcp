import {
  EU_COUNTRY_CODES,
  countryCodeForName,
  isEuCountry,
  isEuropeanCountry,
  regionForCountry,
} from './countries.js';
import type { EmploymentType, Job } from './job.js';
import type { Profile, SkillLevel } from './profile.js';
import { detectRegions } from './remote-scope.js';
import { canonicalSkill, detectSkills, mentionsSkill } from './skills.js';
import { foldText, htmlToText, truncate } from './text.js';

export const RED_FLAG_CODES = [
  'on_site',
  'hybrid',
  'region_restricted',
  'residence_required',
  'work_authorization',
  'language_required',
  'posting_language',
  'employment_type',
  'unpaid',
  'timezone',
  'experience',
] as const;
export type RedFlagCode = (typeof RED_FLAG_CODES)[number];

export interface RedFlag {
  code: RedFlagCode;
  message: string;
  /** The text the flag is based on, so the user can judge it. */
  evidence?: string;
}

export interface MatchResult {
  matched_skills: { skill: string; level: SkillLevel }[];
  /** Skills the listing mentions that aren't in the profile at any level. */
  missing_skills: string[];
  /** matched / (matched + missing), or null when the listing names no known skills. */
  skill_coverage: number | null;
  red_flags: RedFlag[];
  /** Things worth knowing that aren't problems, e.g. a requirement the profile meets. */
  notes: string[];
}

const LEVELS: readonly SkillLevel[] = ['strong', 'some', 'learning'];

const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  full_time: 'full-time',
  part_time: 'part-time',
  contract: 'contract',
  freelance: 'freelance',
  internship: 'an internship',
  unknown: 'unknown',
};

const EU_NAMES = /^(?:the\s+)?(?:eu|european union|eea|european economic area)$/i;

const LANGUAGES: readonly { name: string; native?: RegExp }[] = [
  {
    name: 'German',
    native:
      /deutschkenntnisse|(?:fließend|flie(?:ss|ß)ende[nsr]?|verhandlungssichere[nsr]?|sehr gute[nsr]?)\s+deutsch|deutsch\s*\(?\s*(?:c1|c2|b2|fließend|verhandlungssicher|muttersprache)/i,
  },
  {
    name: 'French',
    native:
      /français (?:courant|natif)|maîtrise du français|français.{0,20}(?:exigé|requis|obligatoire)/i,
  },
  { name: 'Dutch', native: /vloeiend nederlands|nederlandstalig/i },
  { name: 'Spanish', native: /español (?:fluido|nativo)/i },
  { name: 'Italian' },
  { name: 'Portuguese' },
  { name: 'Polish' },
  { name: 'Swedish' },
  { name: 'Danish' },
  { name: 'Norwegian' },
  { name: 'Finnish' },
  { name: 'Czech' },
  { name: 'Japanese' },
  { name: 'Mandarin' },
  { name: 'Korean' },
  { name: 'Hebrew' },
  { name: 'Turkish' },
  { name: 'Arabic' },
];

const NICE_TO_HAVE =
  /\b(?:plus|nice[\s-]to[\s-]have|bonus|advantage|preferred|helpful|beneficial|a benefit|desirable)\b|von vorteil|wünschenswert|un plus|un atout/i;

const STOPWORDS: Record<string, readonly string[]> = {
  English: ['and', 'the', 'with', 'for', 'you', 'we', 'our', 'to', 'of', 'is', 'are', 'will'],
  German: [
    'und',
    'der',
    'die',
    'das',
    'mit',
    'für',
    'wir',
    'sie',
    'ist',
    'nicht',
    'auf',
    'eine',
    'bei',
    'du',
    'dich',
    'deine',
    'ihre',
  ],
  French: [
    'et',
    'les',
    'des',
    'une',
    'pour',
    'avec',
    'vous',
    'nous',
    'dans',
    'est',
    'sur',
    'tu',
    'ton',
    'ta',
  ],
  Dutch: ['en', 'het', 'een', 'van', 'voor', 'met', 'wij', 'je', 'jouw', 'zijn', 'bij', 'jij'],
};

function sentenceAround(text: string, index: number, length: number): string {
  const start = Math.max(
    text.lastIndexOf('.', index) + 1,
    text.lastIndexOf('\n', index) + 1,
    index - 120,
  );
  const endCandidates = [
    text.indexOf('.', index + length),
    text.indexOf('\n', index + length),
  ].filter((i) => i !== -1);
  const end = Math.min(...endCandidates, index + length + 120, text.length);
  return truncate(text.slice(start, end + 1).trim(), 200);
}

function findEvidence(
  text: string,
  pattern: RegExp,
): { match: RegExpExecArray; evidence: string } | undefined {
  const match = new RegExp(pattern.source, pattern.flags.replace('g', '')).exec(text);
  return match
    ? { match, evidence: sentenceAround(text, match.index, match[0].length) }
    : undefined;
}

function hasEuCitizenship(profile: Profile): boolean {
  return profile.citizenship.some((code) => EU_COUNTRY_CODES.has(code));
}

function speaks(profile: Profile, language: string): boolean {
  return profile.languages.some((spoken) => foldText(spoken) === foldText(language));
}

function isEuropeanTimezone(timezone: string): boolean {
  return /^(?:CET|CEST|EET|EEST|WET|WEST|GMT|BST|UTC[+-]?[0-3]?)$|^Europe\//i.test(timezone.trim());
}

// ── Individual checks ───────────────────────────────────────────────────────

function checkSkills(text: string, profile: Profile) {
  const detected = detectSkills(text);
  const mentioned = new Set(detected);
  const matched: MatchResult['matched_skills'] = [];
  const owned = new Set<string>();
  for (const level of LEVELS) {
    for (const skill of profile.skills[level]) {
      const known = canonicalSkill(skill);
      const name = known ?? skill;
      if (owned.has(name)) continue;
      owned.add(name);
      // Catalog skills were already checked by detectSkills; others need a word search.
      if (known ? mentioned.has(known) : mentionsSkill(text, skill)) {
        matched.push({ skill: name, level });
      }
    }
  }
  const missing = detected.filter((skill) => !owned.has(skill));
  const total = matched.length + missing.length;
  return {
    matched,
    missing,
    coverage: total === 0 ? null : Math.round((matched.length / total) * 100) / 100,
  };
}

function checkWorkplace(job: Job, flags: RedFlag[]) {
  if (job.remote_scope !== 'On-site') return;
  const where = `${job.location ?? ''} ${job.title}`;
  if (/\bhybrid\b/i.test(where)) {
    flags.push({
      code: 'hybrid',
      message: 'Hybrid role: needs regular office presence.',
      evidence: job.location ?? job.title,
    });
  } else {
    flags.push({
      code: 'on_site',
      message: 'Not listed as remote (on-site).',
      ...(job.location && { evidence: job.location }),
    });
  }
}

/** A location part naming a region rather than a country: "Europe", "EMEA", "Remote, Global". */
const REGION_WORDS =
  /\b(?:europe|european|eu|eea|emea|worldwide|anywhere|global|international|apac|asia|latam|americas|north america|south america|africa|middle east|nordics|dach|benelux|balkans|cee)\b/i;

/** Words around a country in a location part: "Remote, Poland", "Germany (Remote)", "UK - Remote". */
const LOCATION_NOISE = /\(?\b(?:remote|home[\s-]based|based|office|hq|only)\b\)?|[()]/gi;

/** The country a segment names, with its name as written: "Remote, Poland" → PL, "Poland". */
function countryInSegment(segment: string): { code: string; name: string } | undefined {
  const words = segment
    .replace(LOCATION_NOISE, ' ')
    .split(/[\s-]+/)
    .filter(Boolean);
  // Longest suffix first: "London UK" → "UK", "United Kingdom" before "Kingdom".
  for (let i = 0; i < words.length; i++) {
    const name = words.slice(i).join(' ');
    const code = countryCodeForName(name);
    if (code) return { code, name };
  }
  return undefined;
}

/**
 * The countries a location lists, when it is only a list of countries ("Remote, Poland;
 * Remote, United Kingdom", "Croatia; Serbia; Berlin Office"). Undefined when it names a
 * region (then the scope check applies) or no country. Parts that are neither, such as
 * a city, are ignored.
 */
export function listedCountries(location: string | null): ReadonlyMap<string, string> | undefined {
  if (!location) return undefined;
  /** Code → the country's name as the listing writes it. */
  const countries = new Map<string, string>();
  for (const part of location.split(/[;|\n]/)) {
    if (REGION_WORDS.test(part.replace(LOCATION_NOISE, ' '))) return undefined;
    for (const segment of part.split(',')) {
      const country = countryInSegment(segment);
      if (country && !countries.has(country.code)) countries.set(country.code, country.name);
    }
  }
  return countries.size > 0 ? countries : undefined;
}

/**
 * A remote job that hires in named countries only is usually limited to people living in
 * them (they need an entity or employer of record there), so compare with where the user
 * lives, not with the broad scope. Returns true when it decided.
 */
function checkListedCountries(job: Job, profile: Profile, flags: RedFlag[], notes: string[]) {
  const countries = listedCountries(job.location);
  if (!countries) return false;
  const home = profile.location.country_code;
  if (countries.has(home)) {
    notes.push(`${profile.location.country} is explicitly listed as a hiring country.`);
    return true;
  }
  const citizenOf = profile.citizenship.flatMap((code) => countries.get(code) ?? []);
  flags.push({
    code: 'region_restricted',
    message:
      `Hires only in the listed countries; ${profile.location.country}, where you live, isn't one of them.` +
      (citizenOf.length > 0
        ? ` ${citizenOf.join(' and ')} ${citizenOf.length === 1 ? 'is' : 'are'} listed and you're a citizen, but hiring there usually means living there. Ask whether they can employ you from ${profile.location.country}.`
        : ''),
    ...(job.location && { evidence: job.location }),
  });
  return true;
}

function checkRegion(job: Job, profile: Profile, flags: RedFlag[], notes: string[]) {
  const home = regionForCountry(profile.location.country_code);
  const livesInEu = isEuCountry(profile.location.country_code);
  const evidence = job.location ?? undefined;
  const flag = (message: string) =>
    flags.push({ code: 'region_restricted', message, ...(evidence && { evidence }) });

  const countryScoped =
    job.remote_scope === 'Europe' ||
    job.remote_scope === 'EU only' ||
    job.remote_scope === 'Multi-region';
  if (countryScoped && checkListedCountries(job, profile, flags, notes)) return;

  switch (job.remote_scope) {
    case 'US only':
      if (profile.location.country_code !== 'US') flag('Remote within the US only.');
      break;
    case 'Americas':
      if (home !== 'us' && home !== 'americas') flag('Remote within the Americas only.');
      break;
    case 'Other':
      if (home !== 'other')
        flag(`Remote limited to a region outside yours (${job.location ?? 'see listing'}).`);
      break;
    case 'Multi-region': {
      const regions = detectRegions(job.location);
      const covered =
        regions.has('worldwide') ||
        (home === 'europe' && (regions.has('europe') || regions.has('eu'))) ||
        (home !== undefined && regions.has(home));
      if (!covered) flag(`Your region isn't among the listed ones (${job.location ?? ''}).`);
      break;
    }
    case 'EU only':
      if (!livesInEu) {
        flag(
          hasEuCitizenship(profile)
            ? `Listed as EU only. Check whether that means living in the EU (you live in ${profile.location.country}) or EU work authorization (which you have).`
            : 'Listed as EU only.',
        );
      }
      break;
    case 'Unknown':
      notes.push(
        "Remote, but the listing doesn't say from which countries. Check before applying.",
      );
      break;
    default:
      break;
  }
}

/** "Must be based in the EU", "EU residents only", "must live in Germany". */
function checkResidence(text: string, profile: Profile, flags: RedFlag[]) {
  const livesInEu = isEuCountry(profile.location.country_code);
  const euResidence = findEvidence(
    text,
    /\b(?:must|need to|required to|have to|should|you(?:'re| are)?(?: currently)?)\s+(?:be\s+)?(?:reside|residing|live|living|located|based)\s+(?:in|within)\s+(?:the\s+)?(?:EU|European Union|EEA)\b|\b(?:EU|EEA)[\s-]+residents?\b|\bresiden(?:t|ts|ce|cy)\s+(?:in|within)\s+(?:the\s+)?(?:EU|European Union|EEA)\b/i,
  );
  if (euResidence && !livesInEu) {
    flags.push({
      code: 'residence_required',
      message: `Requires living in the EU; you live in ${profile.location.country}, outside it. EU citizenship may not be enough.`,
      evidence: euResidence.evidence,
    });
  }

  const country = findEvidence(
    text,
    // Case-sensitive on purpose: the capture must be a capitalised place name.
    /\b(?:[Mm]ust|[Nn]eed to|[Rr]equired to|[Hh]ave to)\s+(?:be\s+)?(?:reside|live|located|based)\s+in\s+((?:the\s+)?[A-Z][a-z]+(?:\s+(?:and\s+)?[A-Z][a-z]+)*)/,
  );
  const place = country?.match[1];
  if (country && place && !EU_NAMES.test(place)) {
    const code = countryCodeForName(place);
    if (code !== profile.location.country_code) {
      flags.push({
        code: 'residence_required',
        message: `Requires living in ${place.replace(/^the\s+/i, '')}.`,
        evidence: country.evidence,
      });
    }
  }
}

/** "Authorized to work in the US", "US citizens only", "security clearance". */
function checkWorkAuthorization(text: string, profile: Profile, flags: RedFlag[], notes: string[]) {
  const found = findEvidence(
    text,
    /\b(?:authori[sz]ed|eligible|legally (?:able|allowed)|the right|permitted|permission)\s+to\s+work\s+(?:in|within|from)\s+(?:the\s+)?(EU|European Union|EEA|U\.S\.|US|USA|United States|UK|United Kingdom|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
  );
  const place = found?.match[1];
  if (found && place) {
    const code = countryCodeForName(place);
    const isEu = EU_NAMES.test(place) || (code !== undefined && EU_COUNTRY_CODES.has(code));
    if (isEu && hasEuCitizenship(profile)) {
      notes.push(`Requires the right to work in ${place}: you have it through EU citizenship.`);
    } else if (code && profile.citizenship.includes(code)) {
      notes.push(`Requires the right to work in ${place}: you have it through citizenship.`);
    } else if (isEu || code) {
      flags.push({
        code: 'work_authorization',
        message: `Requires the right to work in ${place}, which your citizenship doesn't give.`,
        evidence: found.evidence,
      });
    }
  }

  const usOnly = findEvidence(
    text,
    /\b(?:US|U\.S\.) citizens?(?:hip)? (?:only|required)\b|\bsecurity clearance\b/i,
  );
  if (usOnly && !profile.citizenship.includes('US')) {
    flags.push({
      code: 'work_authorization',
      message: 'Requires US citizenship or a security clearance.',
      evidence: usOnly.evidence,
    });
  }
}

/** Built once: per language, a cheap "is it mentioned at all" test and the requirement pattern. */
const LANGUAGE_PATTERNS = LANGUAGES.map(({ name, native }) => ({
  name,
  native,
  mentioned: new RegExp(`\\b${name}\\b`, 'i'),
  required: new RegExp(
    `\\b(?:fluent|fluency|native|proficien(?:t|cy)|business[\\s-](?:level|fluent|fluency)|excellent|strong|very good|advanced|professional|full professional)\\s+(?:command of\\s+|level of\\s+|knowledge of\\s+|skills in\\s+|in\\s+|written and spoken\\s+|spoken and written\\s+)?(?:the\\s+)?${name}\\b|\\b${name}\\s*(?:\\(|-|:)?\\s*(?:C1|C2|B2|\\(?native|fluent|required|mandatory|is required|is a must)|\\b(?:speak|speaks|speaking|write|written|spoken)\\s+(?:fluent\\s+)?${name}\\b`,
    'i',
  ),
}));

function checkLanguages(text: string, profile: Profile, flags: RedFlag[], notes: string[]) {
  for (const { name, native, mentioned, required } of LANGUAGE_PATTERNS) {
    if (speaks(profile, name)) continue;
    const found =
      (mentioned.test(text) ? findEvidence(text, required) : undefined) ??
      (native ? findEvidence(text, native) : undefined);
    if (!found) continue;
    const after = text.slice(found.match.index, found.match.index + found.match[0].length + 60);
    if (NICE_TO_HAVE.test(after)) {
      notes.push(`${name} is mentioned as a plus, not a requirement.`);
    } else {
      flags.push({
        code: 'language_required',
        message: `Requires ${name}.`,
        evidence: found.evidence,
      });
    }
  }
}

/** Folded stopword → the languages it belongs to, built once. */
const STOPWORD_LANGUAGES = new Map<string, string[]>();
for (const [language, stopwords] of Object.entries(STOPWORDS)) {
  for (const word of stopwords.map(foldText)) {
    STOPWORD_LANGUAGES.set(word, [...(STOPWORD_LANGUAGES.get(word) ?? []), language]);
  }
}

function checkPostingLanguage(text: string, profile: Profile, flags: RedFlag[]) {
  const words = foldText(text).match(/\p{L}+/gu) ?? [];
  if (words.length < 40) return;
  const counts: Record<string, number> = {};
  for (const word of words) {
    for (const language of STOPWORD_LANGUAGES.get(word) ?? []) {
      counts[language] = (counts[language] ?? 0) + 1;
    }
  }
  const english = counts.English ?? 0;
  for (const [language, count] of Object.entries(counts)) {
    if (language === 'English' || speaks(profile, language)) continue;
    if (count > english * 1.5 && count >= 10) {
      flags.push({
        code: 'posting_language',
        message: `The listing is written in ${language}, so the job likely needs it.`,
      });
    }
  }
}

function checkEmployment(job: Job, profile: Profile, flags: RedFlag[]) {
  const wanted = profile.looking_for.employment_types;
  const type =
    job.employment_type === 'unknown' && /\bpart[\s-]?time\b/i.test(job.title)
      ? 'part_time'
      : job.employment_type;
  if (wanted.length === 0 || type === 'unknown' || wanted.includes(type)) return;
  flags.push({
    code: 'employment_type',
    message: `The role is ${EMPLOYMENT_LABELS[type]}; you're looking for ${wanted.map((t) => EMPLOYMENT_LABELS[t]).join(' or ')}.`,
  });
}

function checkPay(text: string, flags: RedFlag[]) {
  const found = findEvidence(
    text,
    /\bunpaid\b|\bvolunteer(?:ing)?\s+(?:position|role|opportunity|basis)\b|\b(?:equity|commission)[\s-]only\b|\bno\s+(?:salary|pay|compensation)\b|\bwithout\s+(?:pay|compensation)\b/i,
  );
  if (found)
    flags.push({
      code: 'unpaid',
      message: 'Looks unpaid or equity/commission-only.',
      evidence: found.evidence,
    });
}

function checkTimezone(text: string, profile: Profile, flags: RedFlag[], notes: string[]) {
  if (
    !isEuropeanTimezone(profile.location.timezone) &&
    !isEuropeanCountry(profile.location.country_code)
  )
    return;
  const found = findEvidence(
    text,
    // "US"/"Pacific"/"ET" need a zone word after them ("working across Europe and the US" is
    // not a timezone requirement); unambiguous abbreviations like PST stand alone.
    /\b(?:overlap|work(?:ing)?|available|core hours?|business hours)\b[^.\n]{0,60}(?:\b(?:PST|PDT|EST|EDT|CST|CDT)\b|\b(?:US|Pacific|Eastern|Central|Mountain|PT|ET)\s+(?:time(?:\s*zones?)?|hours|business hours|working hours)\b)|\bUS\s+(?:time\s*zones?|business hours|working hours)\b/,
  );
  if (found) {
    flags.push({
      code: 'timezone',
      message: `Expects US working hours; you're on ${profile.location.timezone}.`,
      evidence: found.evidence,
    });
  } else if (/\b(?:CET|CEST|European (?:time ?zones?|hours))\b/i.test(text)) {
    notes.push('Mentions CET or European working hours.');
  }
}

function checkExperience(text: string, profile: Profile, flags: RedFlag[]) {
  if (profile.years_experience === null) return;
  let required = 0;
  let evidence: string | undefined;
  for (const match of text.matchAll(/\b(\d{1,2})\s*\+?\s*(?:years|yrs)\b/gi)) {
    const years = Number(match[1]);
    if (years > required && years <= 25) {
      required = years;
      evidence = sentenceAround(text, match.index, match[0].length);
    }
  }
  if (required > profile.years_experience + 1) {
    flags.push({
      code: 'experience',
      message: `Asks for ${required}+ years; your profile says ${profile.years_experience}.`,
      ...(evidence && { evidence }),
    });
  }
}

/**
 * Compares a job with the profile. Heuristic by design: it surfaces what to check, with
 * the evidence text; it doesn't decide whether to apply.
 */
export function matchJob(job: Job, profile: Profile): MatchResult {
  const text = [
    job.title,
    job.location ?? '',
    job.tags.join(', '),
    htmlToText(job.description),
  ].join('\n');
  const red_flags: RedFlag[] = [];
  const notes: string[] = [];

  const skills = checkSkills(text, profile);
  checkWorkplace(job, red_flags);
  checkRegion(job, profile, red_flags, notes);
  checkResidence(text, profile, red_flags);
  checkWorkAuthorization(text, profile, red_flags, notes);
  checkLanguages(text, profile, red_flags, notes);
  checkPostingLanguage(text, profile, red_flags);
  checkEmployment(job, profile, red_flags);
  checkPay(text, red_flags);
  checkTimezone(text, profile, red_flags, notes);
  checkExperience(text, profile, red_flags);

  return {
    matched_skills: skills.matched,
    missing_skills: skills.missing,
    skill_coverage: skills.coverage,
    red_flags,
    notes,
  };
}
