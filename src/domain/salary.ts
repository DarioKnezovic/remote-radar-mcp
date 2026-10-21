/**
 * Reads the raw salary text of a listing ("$147K – $238K • Offers Equity", "USD 50,000–70,000
 * per year", "€2,800 – €3,285 per month", "$50-$75 /hour") into numbers, so jobs can be
 * filtered by a minimum yearly salary. Anything it can't read with confidence is `null`, and
 * the filter keeps such jobs: most listings state no salary at all.
 */

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'PLN'] as const;
export type Currency = (typeof CURRENCIES)[number];

/**
 * Approximate value of one unit in US dollars, from the Banque de France daily parities of
 * 19 Oct 2026 (quoted per euro, converted here). Good enough to compare salaries; update
 * them by hand now and then.
 */
export const USD_PER_UNIT: Record<Currency, number> = {
  USD: 1,
  EUR: 1.1225,
  GBP: 1.333,
  CAD: 0.7105,
  AUD: 0.6986,
  CHF: 1.2121,
  PLN: 0.2568,
};
export const RATES_DATE = '2026-10-19';

export type PayPeriod = 'hour' | 'day' | 'week' | 'month' | 'year';

/** Full-time assumptions for turning a rate into a yearly amount. */
const PER_YEAR: Record<PayPeriod, number> = {
  hour: 2080, // 40 hours × 52 weeks
  day: 230, // working days, after holidays
  week: 52,
  month: 12,
  year: 1,
};

export interface Salary {
  /** `null` for "up to X". */
  min: number | null;
  /** `null` for "from X". */
  max: number | null;
  currency: Currency;
  period: PayPeriod;
}

/** Longest symbols first, so "CA$" isn't read as "$". */
const CURRENCY_PATTERNS: [RegExp, Currency][] = [
  [/\bCA\$|\bC\$/i, 'CAD'],
  [/\bAU?\$/i, 'AUD'],
  [/\bUS\$/i, 'USD'],
  [/\b(USD|EUR|GBP|CAD|AUD|CHF|PLN)\b/i, 'USD'], // replaced by the matched code below
  [/€/, 'EUR'],
  [/£/, 'GBP'],
  [/\$/, 'USD'],
  [/\bzł|\bzl\b/i, 'PLN'],
];

function detectCurrency(text: string): Currency | null {
  for (const [pattern, currency] of CURRENCY_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const code = match[1]?.toUpperCase();
    return code ? (code as Currency) : currency;
  }
  return null;
}

/** "per hour", "an hour", "/hour", "/h". */
const per = (units: string) => new RegExp(`(?:\\b(?:per|an?)\\s+|\\/\\s*)(?:${units})\\b`, 'i');

const PERIOD_PATTERNS: [RegExp, PayPeriod | 'other'][] = [
  [per('hour|hr|h'), 'hour'],
  [/\bhourly\b/i, 'hour'],
  [per('day|d'), 'day'],
  [/\bdaily\b|\bday rate\b/i, 'day'],
  [per('week|wk'), 'week'],
  [/\bweekly\b/i, 'week'],
  [per('month|mo'), 'month'],
  [/\bmonthly\b/i, 'month'],
  [per('year|yr|annum'), 'year'],
  [/\bannual(?:ly)?\b|\byearly\b|\bp\.a\.?/i, 'year'],
  // Pay per task or project can't be compared with a salary.
  [per('task|project|piece|word|article|unit'), 'other'],
];

function detectPeriod(text: string): PayPeriod | 'other' | null {
  for (const [pattern, period] of PERIOD_PATTERNS) if (pattern.test(text)) return period;
  return null;
}

/**
 * "192,010" → 192010, "107,567.50" → 107567.5, "89.7" → 89.7, and with a k suffix "35,3"
 * → 35.3 (a decimal comma). A lone separator followed by exactly three digits is a
 * thousands separator unless a k follows.
 */
function parseNumber(digits: string, hasSuffix: boolean): number {
  const lastDot = digits.lastIndexOf('.');
  const lastComma = digits.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    const decimal = lastDot > lastComma ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    return Number(digits.replaceAll(thousands, '').replace(decimal, '.'));
  }
  const separator = lastDot !== -1 ? '.' : lastComma !== -1 ? ',' : null;
  if (!separator) return Number(digits);
  const groups = digits.split(separator);
  const thousands = !hasSuffix && groups.slice(1).every((group) => group.length === 3);
  return thousands ? Number(groups.join('')) : Number(groups.join('.'));
}

const AMOUNT = /(\d+(?:[.,]\d+)*)\s*([km])?(?![\d%])/gi;

/** Reads a salary, or returns `null` when the text isn't a salary it can compare. */
export function parseSalary(text: string | null | undefined): Salary | null {
  if (!text) return null;
  // Ashby appends extras ("• Offers Equity • Plus up to 20% bonus"); only the range counts.
  const main = text.split('•')[0] ?? '';
  const currency = detectCurrency(main);
  if (!currency) return null;

  const amounts = [...main.matchAll(AMOUNT)]
    .map(([, digits = '', suffix]) => {
      const multiplier = suffix?.toLowerCase() === 'k' ? 1e3 : suffix ? 1e6 : 1;
      return parseNumber(digits, Boolean(suffix)) * multiplier;
    })
    .filter((value) => Number.isFinite(value) && value > 0)
    .slice(0, 2);
  const [first, second] = amounts;
  if (first === undefined) return null;

  const stated = detectPeriod(main);
  if (stated === 'other') return null;
  const top = second ?? first;
  // Without a stated period only clearly yearly amounts are safe to read.
  const period = stated ?? (top >= 10_000 ? 'year' : null);
  if (!period) return null;

  let min: number | null = Math.min(first, second ?? first);
  let max: number | null = Math.max(first, second ?? first);
  if (second === undefined) {
    if (/\b(?:up to|max(?:imum)?|to)\s*\S*\d/i.test(main)) min = null;
    else if (/\b(?:from|min(?:imum)?|starting(?: at)?)\b|\+/i.test(main)) max = null;
  }

  // A "yearly" salary of USD 30–36 is a data error (likely thousands or hourly): don't guess.
  if (period === 'year' && (max ?? min ?? 0) < 1_000) return null;
  return { min, max, currency, period };
}

export interface YearlyRange {
  min: number | null;
  max: number | null;
}

/** The salary as a yearly range in `currency`, using the approximate rates above. */
export function toYearly(salary: Salary, currency: Currency): YearlyRange {
  const factor = (PER_YEAR[salary.period] * USD_PER_UNIT[salary.currency]) / USD_PER_UNIT[currency];
  return {
    min: salary.min === null ? null : salary.min * factor,
    max: salary.max === null ? null : salary.max * factor,
  };
}

export interface MinSalary {
  /** Yearly, before tax. */
  amount: number;
  currency: Currency;
}

/**
 * Whether a job can pay at least `minimum` a year: its range must reach it. Jobs without a
 * readable salary pass (most listings don't state one), and so does "from X".
 */
export function paysAtLeast(job: { salary: string | null }, minimum: MinSalary): boolean {
  const salary = parseSalary(job.salary);
  if (!salary) return true;
  const { max } = toYearly(salary, minimum.currency);
  return max === null || max >= minimum.amount;
}
