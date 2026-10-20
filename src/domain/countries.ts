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
