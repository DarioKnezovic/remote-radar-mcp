import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Process entry points: exercised by the stdio smoke run, not unit tests.
      exclude: ['src/index.ts', 'src/db/migrate-cli.ts'],
      reporter: ['text', 'html', 'lcov'],
    },
  },
});
