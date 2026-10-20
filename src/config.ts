import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';

/** Matches docker-compose.yml, so `docker compose up -d` is all a local setup needs. */
export const DEFAULT_DATABASE_URL =
  'postgres://remote_radar:remote_radar@localhost:5433/remote_radar';

const configSchema = z.object({
  DATABASE_URL: z
    .string()
    .regex(/^postgres(?:ql)?:\/\//, 'must be a postgres:// URL')
    .default(DEFAULT_DATABASE_URL),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export interface Config {
  databaseUrl: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid configuration: ${issues.join('; ')}`);
  }
  return { databaseUrl: parsed.data.DATABASE_URL, logLevel: parsed.data.LOG_LEVEL };
}

/** Package root; resolves the same from `src/` and `dist/`. */
const PACKAGE_ROOT = new URL('../', import.meta.url);

/**
 * The folder with your own `profile.json` and `boards.json`: `CONFIG_DIR` if set (the
 * Docker web app mounts the project folder there), else the project folder itself. Both
 * the MCP server and the web app read from it, so they share one profile.
 */
export function configDir(env: NodeJS.ProcessEnv = process.env): URL {
  if (!env.CONFIG_DIR) return PACKAGE_ROOT;
  const url = pathToFileURL(resolve(env.CONFIG_DIR));
  return new URL(url.href.endsWith('/') ? url.href : `${url.href}/`);
}
