import { regionForCountry } from './countries.js';
import type { RemoteScope } from './job.js';

export type Region = 'worldwide' | 'europe' | 'eu' | 'us' | 'americas' | 'other';

const EUROPEAN_PLACES = [
  'europe',
  'cet',
  'cest',
  'uk',
  'united kingdom',
  'england',
  'scotland',
  'ireland',
  'germany',
  'deutschland',
  'deutschlandweit',
  'france',
  'spain',
  'portugal',
  'italy',
  'netherlands',
  'belgium',
  'luxembourg',
  'switzerland',
  'austria',
  'poland',
  'czechia',
  'czech republic',
  'slovakia',
  'hungary',
  'slovenia',
  'croatia',
  'bosnia',
  'serbia',
  'montenegro',
  'romania',
  'bulgaria',
  'greece',
  'denmark',
  'sweden',
  'norway',
  'finland',
  'iceland',
  'estonia',
  'latvia',
  'lithuania',
  'ukraine',
  'emea',
];

const AMERICAS_PLACES = [
  'americas',
  'amer',
  'namer',
  'north america',
  'south america',
  'latin america',
  'latam',
  'canada',
  'mexico',
  'brazil',
  'brasil',
  'argentina',
  'colombia',
  'chile',
  'peru',
  'uruguay',
];

const OTHER_PLACES = [
  'apac',
  'asia',
  'emea',
  'australia',
  'new zealand',
  'singapore',
  'india',
  'japan',
  'philippines',
  'indonesia',
  'africa',
  'middle east',
  'israel',
  'uae',
];

function wordList(words: readonly string[]): RegExp {
  return new RegExp(`\\b(?:${words.map((w) => w.replace(/ /g, '\\s+')).join('|')})\\b`, 'i');
}

const MATCHERS: readonly (readonly [Region, readonly RegExp[]])[] = [
  ['worldwide', [/\b(?:worldwide|anywhere|global(?:ly)?|international)\b/i]],
  // "EU" and "US" are matched case-sensitively so ordinary words ("us", "eu-") don't trigger them.
  ['eu', [/\bEU\b/, /\beuropean\s+union\b/i]],
  ['us', [/\b(?:US|USA|U\.S\.(?:A\.)?)(?!\w)/, /\bunited\s+states\b/i]],
  ['europe', [wordList(EUROPEAN_PLACES), /\beuropean\b(?!\s+union)/i]],
  ['americas', [wordList(AMERICAS_PLACES)]],
  ['other', [wordList(OTHER_PLACES)]],
];

/** All regions mentioned in a free-text location such as "Europe, USA, Canada, APAC". */
export function detectRegions(location: string | null | undefined): ReadonlySet<Region> {
  const regions = new Set<Region>();
  if (!location) return regions;
  for (const [region, patterns] of MATCHERS) {
    if (patterns.some((pattern) => pattern.test(location))) regions.add(region);
  }
  return regions;
}

function isSubsetOf(regions: ReadonlySet<Region>, allowed: readonly Region[]): boolean {
  return [...regions].every((region) => allowed.includes(region));
}

/**
 * Classifies a remote job's free-text location into a {@link RemoteScope}.
 *
 * Text that mentions anywhere/worldwide wins ("Worldwide, CET preferred" is still
 * worldwide). Text naming several unrelated regions becomes `Multi-region`.
 */
export function classifyRemoteScope(location: string | null | undefined): RemoteScope {
  if (!location?.trim()) return 'Unknown';
  const regions = detectRegions(location);
  return regions.size === 0 ? 'Other' : scopeFromRegions(regions);
}

/** Maps a non-empty set of detected regions to a {@link RemoteScope}. */
export function scopeFromRegions(regions: ReadonlySet<Region>): RemoteScope {
  if (regions.size === 0) return 'Unknown';
  if (regions.has('worldwide')) return 'Worldwide';
  if (regions.size === 1 && regions.has('eu')) return 'EU only';
  if (regions.size === 1 && regions.has('us')) return 'US only';
  if (isSubsetOf(regions, ['europe', 'eu'])) return 'Europe';
  if (isSubsetOf(regions, ['us', 'americas'])) return 'Americas';
  if (regions.size === 1 && regions.has('other')) return 'Other';
  return 'Multi-region';
}

/**
 * "Remote" as written in listings across languages and job boards: "Remote", "Home based"
 * (Canonical), "Homeoffice" (DE), "Werken op afstand" (NL), "Télétravail"/"à distance" (FR),
 * "Remoto" (ES/PT).
 */
const REMOTE_HINT =
  /\b(?:remote|remoto|home[\s-]?(?:office|based)|werken op afstand|t[ée]l[ée]travail)\b|à distance/i;

export function looksRemote(text: string | null | undefined): boolean {
  return REMOTE_HINT.test(text ?? '');
}

/**
 * Scope of a listing. Regions come from the location first, then the job's country code
 * (when the source provides one), then the title ("Backend Developer - Remote from EU").
 * A city ("Berlin") or just "Remote" says nothing about where remote work is allowed,
 * so it stays `Unknown`.
 */
export function remoteScopeFor(
  isRemote: boolean,
  location: string | null,
  title: string,
  countryCode?: string | null,
): RemoteScope {
  if (!isRemote) return 'On-site';
  const fromLocation = detectRegions(location);
  if (fromLocation.size > 0) return scopeFromRegions(fromLocation);
  const fromCountry = regionForCountry(countryCode);
  if (fromCountry) return scopeFromRegions(new Set([fromCountry]));
  // "Global"/"International" in a title describes the role ("Global Head of Sales"), not eligibility.
  const fromTitle = new Set([...detectRegions(title)].filter((region) => region !== 'worldwide'));
  return scopeFromRegions(fromTitle);
}
