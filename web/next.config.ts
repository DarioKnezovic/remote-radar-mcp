import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

/** The repository root: the core package and the shared node_modules live there. */
const root = dirname(dirname(fileURLToPath(import.meta.url)));

const config: NextConfig = {
  // Load the core with plain Node instead of bundling it: it finds profile.json, the boards
  // file and its migrations relative to its own files, and talks to Postgres via `pg`.
  serverExternalPackages: ['remote-radar-mcp'],
  outputFileTracingRoot: root,
  turbopack: { root },
  poweredByHeader: false,
};

export default config;
