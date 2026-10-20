/**
 * The pure part of the core: types, constants and the job matcher. No database, files or
 * network, so a bundler (the web app) can include it. Published as `remote-radar-mcp/domain`.
 */
export { APPLICATION_STATUSES, type ApplicationStatus, type SavedJob } from './application.js';
export { isEuCountry, regionForCountry } from './countries.js';
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
export { profileSchema, type Profile, type SkillLevel } from './profile.js';
export { htmlToText, truncate } from './text.js';
export { VERSION } from '../version.js';
