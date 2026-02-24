import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "e2e",
    include: ["test/e2e/**/*.e2e.test.ts"],
    globals: true,
    environment: "node",
    testTimeout: 120000, // 2 minutes per test
    hookTimeout: 120000, // 2 minutes for beforeAll/afterAll
    bail: 0, // Continue running all tests even if some fail
    isolate: true, // Run each test file in isolation
    pool: "forks", // Use separate processes for better isolation
    poolOptions: {
      forks: {
        singleFork: false
      }
    },
    setupFiles: [],
    coverage: {
      enabled: false, // Disable coverage for E2E tests (too slow)
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "test/**",
        "dist/**",
        "**/*.d.ts",
        "**/*.config.ts"
      ]
    },
    reporters: ["verbose"],
    outputFile: {
      json: "./test-results/e2e-results.json"
    }
  }
});
