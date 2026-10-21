import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

/** The repository root: the core package and the shared node_modules live there. */
const root = dirname(dirname(fileURLToPath(import.meta.url)));

const config: NextConfig = {
  // Load the core with plain Node instead of bundling it: it finds profile.json, the boards
  // file and its migrations relative to its own files, and talks to Postgres via `pg`.
  serverExternalPackages: ['remote-radar-mcp'],
  // The Docker build sets this: a self-contained server with only the files it uses, for a
  // small image. Off otherwise, since `next start` warns about it.
  ...(process.env.NEXT_STANDALONE === '1' && {
    output: 'standalone',
    // Next.js traces sharp for image optimization, which this app doesn't use.
    // Paths are relative to web/; node_modules is in the repository root.
    outputFileTracingExcludes: { '*': ['../node_modules/sharp/**', '../node_modules/@img/**'] },
  }),
  outputFileTracingRoot: root,
  turbopack: { root },
  poweredByHeader: false,
};

export default config;
