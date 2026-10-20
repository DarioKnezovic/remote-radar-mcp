const DAY_MS = 24 * 60 * 60 * 1000;

/** "today", "3 days ago", "2 months ago": how long ago a job was posted. */
export function postedAgo(iso: string, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - Date.parse(iso)) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? 'over a year ago' : `over ${years} years ago`;
}

/** "20 Oct 2026". Fixed locale and time zone, so the server and browser agree. */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso));
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`;
}

/** Job ids contain ":" (e.g. "ashby:n8n:…"), so they're encoded in URLs. */
export function jobHref(id: string): string {
  return `/jobs/${encodeURIComponent(id)}`;
}
