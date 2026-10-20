import type { EmploymentType } from './job.js';

/**
 * Free-text contract labels from any source, in several languages: "Full Time",
 * "Werkstudent", "CDI", "Full Time Contractor", "Permanent". Seniority labels ("Mid",
 * "berufserfahren") match nothing and are ignored.
 *
 * When several match, the first in this list wins: an internship is an internship even
 * if it's also "full time", and a "Full Time Contractor" is a contractor. Plain
 * "contract" is checked last because it also appears in permanent labels such as
 * "Indefinite contract (unbefristeter Arbeitsvertrag)".
 */
const EMPLOYMENT_PATTERNS: readonly (readonly [EmploymentType, RegExp])[] = [
  ['internship', /\b(?:intern(?:ship)?|praktikum\w*|stage|convention de stage)\b/i],
  [
    'freelance',
    /\b(?:freelanc\w*|freiberufl\w*|selbstst[äa]ndig\w*|self-employed|ind[ée]pendant|auto-entrepreneur)\b/i,
  ],
  ['contract', /\b(?:contractor|b2b)\b/i],
  ['full_time', /\b(?:full[\s-]?time|vollzeit|permanent|unbefristet\w*|cdi|indefinite)\b/i],
  [
    'part_time',
    /\b(?:part[\s-]?time|teilzeit|werkstudent\w*|working student|minijob|nebent[äa]tigkeit)\b/i,
  ],
  ['contract', /\b(?:contract|temporary|short[\s-]term|fixed[\s-]term|befristet\w*|cdd)\b/i],
];

export function employmentTypeFromLabels(
  labels: readonly (string | null | undefined)[],
): EmploymentType {
  const present = labels.filter((label): label is string => Boolean(label));
  for (const [type, pattern] of EMPLOYMENT_PATTERNS) {
    if (present.some((label) => pattern.test(label))) return type;
  }
  return 'unknown';
}
