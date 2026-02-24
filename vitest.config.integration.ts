import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'integration',
    include: ['**/test/integration/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 10000,
    isolate: true,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },
    // Run integration tests sequentially to avoid resource conflicts
    maxConcurrency: 1,
    // Retry failed tests once
    retry: 1,
    // Setup files
    setupFiles: ['./test/integration-setup.ts'],
  },
});
