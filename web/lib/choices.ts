import 'server-only';

export interface Choice {
  value: string;
  label: string;
}

/** Codes that are regions or groups, not countries (EU, Eurozone, United Nations, …). */
const NOT_COUNTRIES = new Set(['EU', 'EZ', 'UN', 'QO', 'ZZ']);

/**
 * Every country, as ISO code + English name, sorted by name. Built from Intl, so there's no
 * list to maintain. Computed on the server and passed to forms, so the browser shows the
 * exact same names (its Intl data may differ).
 */
export function countryChoices(): Choice[] {
  const names = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const choices: Choice[] = [];
  for (const a of letters) {
    for (const b of letters) {
      const code = a + b;
      // Private-use ranges (AA, QM–QZ, XA–XZ except Kosovo, ZZ) have no real country.
      if (NOT_COUNTRIES.has(code) || code === 'AA' || (a === 'Q' && b >= 'M')) continue;
      if (a === 'X' && code !== 'XK') continue;
      const label = names.of(code);
      if (label && label !== code) choices.push({ value: code, label });
    }
  }
  return choices.sort((x, y) => x.label.localeCompare(y.label, 'en'));
}

/** IANA time zones ("Europe/Sarajevo"), plus the short European ones people often use. */
export function timezoneChoices(): string[] {
  return ['CET', 'EET', 'WET', 'UTC', ...Intl.supportedValuesOf('timeZone')];
}

/** Common working languages, as suggestions. Any other language can be typed in. */
export const LANGUAGE_SUGGESTIONS = [
  'English',
  'German',
  'French',
  'Spanish',
  'Portuguese',
  'Italian',
  'Dutch',
  'Polish',
  'Croatian',
  'Serbian',
  'Bosnian',
  'Slovenian',
  'Czech',
  'Slovak',
  'Hungarian',
  'Romanian',
  'Bulgarian',
  'Greek',
  'Turkish',
  'Ukrainian',
  'Russian',
  'Swedish',
  'Norwegian',
  'Danish',
  'Finnish',
  'Estonian',
  'Latvian',
  'Lithuanian',
  'Albanian',
  'Macedonian',
  'Arabic',
  'Hebrew',
  'Hindi',
  'Mandarin',
  'Japanese',
  'Korean',
] as const;
