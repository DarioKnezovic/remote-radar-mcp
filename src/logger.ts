/**
 * Minimal logger that writes to stderr only.
 *
 * With the stdio transport, stdout carries JSON-RPC messages, so a single stray
 * `console.log` would corrupt the protocol stream. Everything diagnostic goes here.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const env = process.env.LOG_LEVEL as Level | undefined;
  return order[env ?? 'info'];
}

function write(level: Level, message: string, context?: Record<string, unknown>): void {
  if (order[level] < threshold()) return;
  const line = { time: new Date().toISOString(), level, message, ...context };
  console.error(JSON.stringify(line));
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => {
    write('debug', message, context);
  },
  info: (message: string, context?: Record<string, unknown>) => {
    write('info', message, context);
  },
  warn: (message: string, context?: Record<string, unknown>) => {
    write('warn', message, context);
  },
  error: (message: string, context?: Record<string, unknown>) => {
    write('error', message, context);
  },
};
