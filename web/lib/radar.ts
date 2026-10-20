import type { RemoteRadar } from 'remote-radar-mcp/app';

/**
 * Loads the core's runtime with plain Node instead of bundling it: it finds its migrations,
 * profile.json and boards file relative to its own files, which bundling would break.
 * (`serverExternalPackages` doesn't apply here, because the package is a local link.)
 */
async function importCore(): Promise<typeof import('remote-radar-mcp/app')> {
  return import(/* turbopackIgnore: true */ /* webpackIgnore: true */ 'remote-radar-mcp/app');
}

// One instance per server process. Kept on globalThis so hot reloads in development
// don't open a new database pool on every edit.
const globalForRadar = globalThis as typeof globalThis & { radar?: Promise<RemoteRadar> };

/** The shared core (database, sources, tracker, profile). Server-side only. */
export function getRadar(): Promise<RemoteRadar> {
  globalForRadar.radar ??= importCore()
    .then(({ createRemoteRadar }) => createRemoteRadar())
    .catch((error: unknown) => {
      // Don't cache a failure (e.g. Postgres not started yet): retry on the next request.
      globalForRadar.radar = undefined;
      throw error;
    });
  return globalForRadar.radar;
}
