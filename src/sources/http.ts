export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export interface HttpClient {
  getJson(url: string): Promise<unknown>;
}

export class HttpError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
    statusText: string,
  ) {
    super(`GET ${url} failed: ${status} ${statusText}`.trim());
    this.name = 'HttpError';
  }
}

export interface HttpClientOptions {
  userAgent: string;
  timeoutMs?: number;
  fetchFn?: FetchFn;
}

export function createHttpClient({
  userAgent,
  timeoutMs = 15_000,
  fetchFn = fetch,
}: HttpClientOptions): HttpClient {
  return {
    async getJson(url) {
      const response = await fetchFn(url, {
        headers: { Accept: 'application/json', 'User-Agent': userAgent },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new HttpError(url, response.status, response.statusText);
      return response.json();
    },
  };
}
