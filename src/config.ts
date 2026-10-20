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
