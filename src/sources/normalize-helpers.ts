import { detectRegions, looksRemote } from '../domain/remote-scope.js';

/**
 * Converts a source timestamp into ISO 8601 UTC. Strings without a timezone are
 * treated as UTC (Remotive sends "2026-10-17T16:04:29"); numbers are Unix seconds.
 */
export function toIsoUtc(value: string | number): string {
  const date =
    typeof value === 'number'
      ? new Date(value * 1000)
      : new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${String(value)}`);
  return date.toISOString();
}

/**
 * Some listings put the location in the title: Grafana Labs ("Staff PM, Platform | Germany |
 * Remote", on Greenhouse and reposted on Arbeitnow) or n8n ("Engineering Manager | Remote |
 * Europe"). Returns the title part and the rest as a location hint, so per-country copies
 * share a title. Only splits when the trailing parts look like a location, so "Engineer |
 * Payments" keeps its team name (and doesn't merge with "Engineer | Growth").
 */
export function splitTitle(rawTitle: string): { title: string; extra: string | null } {
  const [title = '', ...rest] = rawTitle.split('|').map((part) => part.trim());
  const extra = rest.filter(Boolean).join(', ');
  const isLocation = looksRemote(extra) || detectRegions(extra).size > 0;
  return title && extra && isLocation ? { title, extra } : { title: rawTitle.trim(), extra: null };
}

/** Trims text and turns empty or missing values into `null`. */
export function textOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed !== undefined && trimmed.length > 0 ? trimmed : null;
}

/** Trims, drops empties, and removes case-insensitive duplicates while keeping the first spelling. */
export function normalizeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const trimmed = tag.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export interface SalaryRange {
  min?: number | null | undefined;
  max?: number | null | undefined;
  currency?: string | null | undefined;
  /** e.g. Lever's "per-year-salary", "per-hour-wage". */
  interval?: string | null | undefined;
}

const amount = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** "USD 140,000–250,000 per year". Zero or missing bounds count as not given. */
export function formatSalaryRange({ min, max, currency, interval }: SalaryRange): string | null {
  const low = min && min > 0 ? min : undefined;
  const high = max && max > 0 ? max : undefined;
  if (low === undefined && high === undefined) return null;
  const range =
    low !== undefined && high !== undefined
      ? low === high
        ? amount.format(low)
        : `${amount.format(low)}–${amount.format(high)}`
      : low !== undefined
        ? `from ${amount.format(low)}`
        : `up to ${amount.format(high ?? 0)}`;
  const period = interval?.match(/^per[-\s]([a-z]+)/i)?.[1];
  return [currency?.toUpperCase(), range, period ? `per ${period.toLowerCase()}` : null]
    .filter(Boolean)
    .join(' ');
}
