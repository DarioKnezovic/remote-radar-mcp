import { foldText } from './text.js';

/** EU member states (ISO 3166-1 alpha-2), as of 2026. */
export const EU_COUNTRY_CODES: ReadonlySet<string> = new Set(
  'AT BE BG CY CZ DE DK EE ES FI FR GR HR HU IE IT LT LU LV MT NL PL PT RO SE SI SK'.split(' '),
);

/** European countries outside the EU. */
const OTHER_EUROPEAN_CODES: ReadonlySet<string> = new Set(
  'AL AD BA BY CH FO GB GI IS LI MC MD ME MK NO RS SM UA VA XK'.split(' '),
);

const AMERICAS_CODES: ReadonlySet<string> = new Set(
  'CA MX BR AR CL CO PE UY PY BO EC VE CR PA GT HN SV NI DO CU JM PR TT'.split(' '),
);

export function isEuCountry(code: string | null | undefined): boolean {
  return code !== null && code !== undefined && EU_COUNTRY_CODES.has(code.toUpperCase());
}

export function isEuropeanCountry(code: string | null | undefined): boolean {
  if (!code) return false;
  const upper = code.toUpperCase();
  return EU_COUNTRY_CODES.has(upper) || OTHER_EUROPEAN_CODES.has(upper);
}

/** Coarse region for a country code, matching the regions used by remote-scope detection. */
export function regionForCountry(
  code: string | null | undefined,
): 'europe' | 'us' | 'americas' | 'other' | undefined {
  if (!code || !/^[a-z]{2}$/i.test(code)) return undefined;
  const upper = code.toUpperCase();
  if (upper === 'US') return 'us';
  if (isEuropeanCountry(upper)) return 'europe';
  if (AMERICAS_CODES.has(upper)) return 'americas';
  return 'other';
}

/** English names (and common short forms) → codes, for reading locations and requirement clauses. */
const COUNTRY_NAMES: Record<string, string> = {
  'united states': 'US',
  'united states of america': 'US',
  us: 'US',
  'u.s.': 'US',
  usa: 'US',
  america: 'US',
  'united kingdom': 'GB',
  uk: 'GB',
  britain: 'GB',
  'great britain': 'GB',
  england: 'GB',
  scotland: 'GB',
  wales: 'GB',
  'northern ireland': 'GB',
  ireland: 'IE',
  'republic of ireland': 'IE',
  germany: 'DE',
  deutschland: 'DE',
  france: 'FR',
  netherlands: 'NL',
  holland: 'NL',
  belgium: 'BE',
  luxembourg: 'LU',
  spain: 'ES',
  portugal: 'PT',
  italy: 'IT',
  malta: 'MT',
  cyprus: 'CY',
  greece: 'GR',
  austria: 'AT',
  switzerland: 'CH',
  liechtenstein: 'LI',
  poland: 'PL',
  czechia: 'CZ',
  'czech republic': 'CZ',
  slovakia: 'SK',
  hungary: 'HU',
  slovenia: 'SI',
  croatia: 'HR',
  romania: 'RO',
  bulgaria: 'BG',
  estonia: 'EE',
  latvia: 'LV',
  lithuania: 'LT',
  finland: 'FI',
  sweden: 'SE',
  denmark: 'DK',
  norway: 'NO',
  iceland: 'IS',
  bosnia: 'BA',
  'bosnia and herzegovina': 'BA',
  'bosnia & herzegovina': 'BA',
  serbia: 'RS',
  montenegro: 'ME',
  'north macedonia': 'MK',
  macedonia: 'MK',
  albania: 'AL',
  kosovo: 'XK',
  moldova: 'MD',
  ukraine: 'UA',
  georgia: 'GE',
  armenia: 'AM',
  turkey: 'TR',
  turkiye: 'TR',
  israel: 'IL',
  canada: 'CA',
  mexico: 'MX',
  brazil: 'BR',
  argentina: 'AR',
  chile: 'CL',
  colombia: 'CO',
  peru: 'PE',
  uruguay: 'UY',
  'costa rica': 'CR',
  australia: 'AU',
  'new zealand': 'NZ',
  india: 'IN',
  japan: 'JP',
  singapore: 'SG',
  philippines: 'PH',
  indonesia: 'ID',
  'south africa': 'ZA',
  nigeria: 'NG',
  kenya: 'KE',
  egypt: 'EG',
  'united arab emirates': 'AE',
  uae: 'AE',
};

/** "Croatia", "the Netherlands", "UK" → ISO code; undefined for anything else (cities, regions). */
export function countryCodeForName(name: string): string | undefined {
  const key = foldText(name).trim().replace(/\s+/g, ' ').replace(/^the /, '');
  return COUNTRY_NAMES[key];
}
