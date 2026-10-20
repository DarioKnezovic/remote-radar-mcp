import pg from 'pg';
import { logger } from '../logger.js';

export function createPool(connectionString: string, options: pg.PoolConfig = {}): pg.Pool {
  const pool = new pg.Pool({ connectionString, max: 5, ...options });
  // Without a listener, an idle client error (e.g. Postgres restarting) crashes the process.
  pool.on('error', (error) => {
    logger.error('idle Postgres client error', { error: error.message });
  });
  return pool;
}
