import {
  CURRENCIES,
  regionForCountry,
  type Currency,
  type Profile,
  type RemoteScope,
} from 'remote-radar-mcp/domain';

/** "Where do you want to work from?", in the words the form uses. */
export const WHERE_OPTIONS = {
  mine: 'Open to where I live',
  worldwide: 'Open to anyone, anywhere',
  all: 'All remote jobs',
} as const;
export type Where = keyof typeof WHERE_OPTIONS;

export const DAYS_OPTIONS = {
  0: 'Any time',
  7: 'In the last week',
  30: 'In the last month',
} as const;
export type Days = keyof typeof DAYS_OPTIONS;

export const SORT_OPTIONS = { newest: 'Newest first', fit: 'Best fit for me first' } as const;
export type Sort = keyof typeof SORT_OPTIONS;

export const PAGE_SIZE = 30;

export interface JobQuery {
  q: string;
  where: Where;
  days: Days;
  /** Hide jobs that got any warning. */
  clean: boolean;
  sort: Sort;
  /** Minimum yearly salary in `currency`; 0 for none. */
  pay: number;
  currency: Currency;
  /** Only jobs that state a salary. */
  paid: boolean;
  /** How many results to show (grows with "Show more"). */
  show: number;
}

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

function oneOf<T extends string>(value: string, options: Record<T, unknown>, fallback: T): T {
  return value in options ? (value as T) : fallback;
}

/** The currency salaries are most likely quoted in where the profile says you live. */
const CURRENCY_BY_COUNTRY: Record<string, Currency> = {
  US: 'USD',
  CA: 'CAD',
  GB: 'GBP',
  CH: 'CHF',
  PL: 'PLN',
  AU: 'AUD',
};

export function currencyFor(profile: Profile | undefined): Currency {
  const code = profile?.location.country_code.toUpperCase() ?? '';
  return CURRENCY_BY_COUNTRY[code] ?? (regionForCountry(code) === 'europe' ? 'EUR' : 'USD');
}

/** Reads the search form from the URL. Unknown values fall back to defaults. */
export function parseQuery(
  params: Params,
  hasProfile: boolean,
  defaultCurrency: Currency = 'USD',
): JobQuery {
  const days = Number(first(params.days));
  const show = Number(first(params.show));
  // "80,000", "80 000", "80k" or "80.5k" as typed; anything else means no minimum.
  const payText = first(params.pay).toLowerCase().replace(/[\s']/g, '');
  const pay = Math.round(
    payText.endsWith('k')
      ? Number(payText.slice(0, -1).replace(',', '.')) * 1000
      : Number(payText.replace(/[,.]/g, '')),
  );
  const currency = first(params.currency).toUpperCase();
  // Without a profile there's no "where I live" and no fit to sort or filter by.
  const where = oneOf<Where>(first(params.where), WHERE_OPTIONS, hasProfile ? 'mine' : 'all');
  return {
    q: first(params.q).slice(0, 200),
    where: !hasProfile && where === 'mine' ? 'all' : where,
    days: days === 7 || days === 30 ? days : 0,
    clean: hasProfile && first(params.clean) === '1',
    sort: hasProfile ? oneOf<Sort>(first(params.sort), SORT_OPTIONS, 'newest') : 'newest',
    pay: Number.isInteger(pay) && pay > 0 ? Math.min(pay, 10_000_000) : 0,
    currency: (CURRENCIES as readonly string[]).includes(currency)
      ? (currency as Currency)
      : defaultCurrency,
    paid: first(params.paid) === '1',
    show: Number.isInteger(show) && show > PAGE_SIZE ? Math.min(show, 600) : PAGE_SIZE,
  };
}

/** The URL for a query; only non-default values are included, so links stay short. */
export function queryHref(query: JobQuery, changes: Partial<JobQuery> = {}): string {
  const next = { ...query, ...changes };
  const params = new URLSearchParams();
  if (next.q) params.set('q', next.q);
  params.set('where', next.where);
  if (next.days) params.set('days', String(next.days));
  if (next.clean) params.set('clean', '1');
  if (next.sort !== 'newest') params.set('sort', next.sort);
  if (next.pay) params.set('pay', String(next.pay));
  if (next.pay) params.set('currency', next.currency);
  if (next.paid) params.set('paid', '1');
  if (next.show > PAGE_SIZE) params.set('show', String(next.show));
  return `/jobs?${params.toString()}`;
}

/**
 * The remote scopes a job may have to be open to someone living where the profile says.
 * "Several regions" jobs are included when their location names the region (the core's
 * filter checks that).
 */
export function scopesFor(where: Where, profile: Profile | undefined): RemoteScope[] | undefined {
  if (where === 'all') return undefined; // every remote job, office jobs excluded
  if (where === 'worldwide' || !profile) return ['Worldwide'];
  switch (regionForCountry(profile.location.country_code)) {
    case 'europe':
      return ['Worldwide', 'Europe', 'EU only'];
    case 'us':
      return ['Worldwide', 'US only', 'Americas'];
    case 'americas':
      return ['Worldwide', 'Americas'];
    default:
      return ['Worldwide', 'Other'];
  }
}
