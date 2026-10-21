/**
 * The pure part of the core: types, constants and the job matcher. No database, files or
 * network, so a bundler (the web app) can include it. Published as `remote-radar-mcp/domain`.
 */
export { APPLICATION_STATUSES, type ApplicationStatus, type SavedJob } from './application.js';
export { isEuCountry, regionForCountry } from './countries.js';
export {
  coverLetterPromptIntro,
  draftCoverLetter,
  NAME_PLACEHOLDER,
  pickStory,
  STORY_PLACEHOLDER,
  type CoverLetterInput,
} from './cover-letter.js';
export { otherListings, type OtherListing } from './dedupe.js';
export {
  EMPLOYMENT_TYPES,
  REMOTE_SCOPES,
  SOURCE_IDS,
  type EmploymentType,
  type Job,
  type RemoteScope,
  type SourceId,
} from './job.js';
export {
  matchJob,
  RED_FLAG_CODES,
  type MatchResult,
  type RedFlag,
  type RedFlagCode,
} from './match.js';
export { profileSchema, type Profile, type ProfileInput, type SkillLevel } from './profile.js';
export {
  CURRENCIES,
  parseSalary,
  RATES_DATE,
  toYearly,
  type Currency,
  type MinSalary,
  type PayPeriod,
  type Salary,
} from './salary.js';
export { canonicalSkill, SKILL_NAMES } from './skills.js';
export { htmlToText, truncate } from './text.js';
export { VERSION } from '../version.js';
