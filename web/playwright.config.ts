import { defineConfig, devices } from '@playwright/test';
import { E2E_DATABASE_URL, PROFILE_FILE } from './e2e/env';

const PORT = 3100;

/**
 * Browser tests against the built web app (`npm run web:build` first) and a fresh demo
 * database of made-up jobs, recorded as freshly fetched, so no job API is called.
 */
export default defineConfig({
  testDir: './e2e',
  // One app, one database and one profile file: the tests take turns.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    timezoneId: 'Europe/Zagreb',
    locale: 'en-GB',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx tsx e2e/prepare-db.ts && npx next start -H 127.0.0.1 -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/how-it-works`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      PROFILE_FILE,
      // The starter list, not your own boards.json; the seed covers every source anyway.
      BOARDS_FILE: '../boards.default.json',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
