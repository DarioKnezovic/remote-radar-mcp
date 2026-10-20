import { loadConfig } from '../config.js';
import { logger } from '../logger.js';
import { migrate } from './migrate.js';
import { createPool } from './pool.js';

/** `npm run db:migrate` — the server also migrates on start; this is for doing it explicitly. */
const pool = createPool(loadConfig().databaseUrl);
try {
  const applied = await migrate(pool);
  logger.info(applied.length > 0 ? 'migrations applied' : 'database is up to date', { applied });
} finally {
  await pool.end();
}
