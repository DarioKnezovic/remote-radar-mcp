import { connection } from 'next/server';
import type { RemoteRadar } from 'remote-radar-mcp/app';
import { getRadar } from './radar';

export type LoadResult = { ok: true; radar: RemoteRadar } | { ok: false; error: string };

/**
 * Gets the core for a page. Marks the page as dynamic (it shows live data, so it must
 * never be prerendered at build time) and turns a startup failure, such as Postgres not
 * running, into a message the page can show instead of crashing.
 */
export async function loadRadar(): Promise<LoadResult> {
  await connection();
  try {
    return { ok: true, radar: await getRadar() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
