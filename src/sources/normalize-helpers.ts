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
