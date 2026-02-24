/**
 * Integration Tests Setup
 * Runs before all integration tests to ensure services are ready
 */

import { beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createClient } from 'redis';

const MAX_RETRIES = 30;
const RETRY_DELAY = 1000;

/**
 * Wait for PostgreSQL to be ready
 */
async function waitForPostgres(): Promise<void> {
  const config = {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: 'postgres',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
  };

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const client = new Client(config);
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      console.log('✓ PostgreSQL is ready');
      return;
    } catch (error) {
      if (i === MAX_RETRIES - 1) {
        throw new Error(`PostgreSQL not ready after ${MAX_RETRIES} attempts`);
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
    }
  }
}

/**
 * Wait for Redis to be ready
 */
async function waitForRedis(): Promise<void> {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const client = createClient({ url });
      await client.connect();
      await client.ping();
      await client.quit();
      console.log('✓ Redis is ready');
      return;
    } catch (error) {
      if (i === MAX_RETRIES - 1) {
        throw new Error(`Redis not ready after ${MAX_RETRIES} attempts`);
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
    }
  }
}

/**
 * Wait for LiteLLM to be ready
 */
async function waitForLiteLLM(): Promise<void> {
  const baseURL = process.env.LITELLM_API_BASE || 'http://localhost:4001';

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const response = await fetch(`${baseURL}/health`, {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        console.log('✓ LiteLLM is ready');
        return;
      }
    } catch (error) {
      if (i === MAX_RETRIES - 1) {
        console.warn('⚠ LiteLLM not ready - some tests may fail');
        return; // Don't throw, allow tests to run
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
    }
  }
}

// Setup before all tests
beforeAll(async () => {
  console.log('Setting up integration test environment...');

  await Promise.all([
    waitForPostgres(),
    waitForRedis(),
    waitForLiteLLM(),
  ]);

  console.log('Integration test environment ready\n');
}, 60000);

// Cleanup after all tests
afterAll(async () => {
  console.log('\nIntegration tests completed');
});
