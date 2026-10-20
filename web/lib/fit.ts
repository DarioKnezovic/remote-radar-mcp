import { matchJob, type Job, type MatchResult, type Profile } from 'remote-radar-mcp/domain';

/**
 * Match results, cached per job while the profile stays the same. Matching reads the
 * whole listing (about 1 ms per job), so sorting a thousand results by fit is only slow
 * the first time. Changing the profile empties the cache.
 */
const MAX_ENTRIES = 5000;
let cachedFor = '';
const cache = new Map<string, MatchResult>();

function jobKey(job: Job): string {
  // A listing that changed (edited description or location) is matched again.
  return `${job.id}|${job.description.length}|${job.location ?? ''}|${job.remote_scope}|${job.employment_type}`;
}

export function fitFor(job: Job, profile: Profile): MatchResult {
  const profileKey = JSON.stringify(profile);
  if (profileKey !== cachedFor) {
    cache.clear();
    cachedFor = profileKey;
  }
  const key = jobKey(job);
  let result = cache.get(key);
  if (!result) {
    if (cache.size >= MAX_ENTRIES) cache.clear();
    result = matchJob(job, profile);
    cache.set(key, result);
  }
  return result;
}

/**
 * Higher is a better fit: no warnings first, then more of the listing's skills covered.
 * Coverage counts less when the listing names few skills, so "2 of 2" doesn't outrank
 * "5 of 6".
 */
export function fitScore(fit: MatchResult): number {
  const named = fit.matched_skills.length + fit.missing_skills.length;
  const skills = (fit.skill_coverage ?? 0) * (Math.min(named, 5) / 5);
  return (fit.red_flags.length === 0 ? 10 : -fit.red_flags.length) + skills;
}
