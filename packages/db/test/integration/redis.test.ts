/**
 * Redis Integration Tests
 * Tests caching, locks, pub/sub, and BullMQ queues
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createClient, RedisClientType } from 'redis';

const TEST_TIMEOUT = 30000;

const getRedisConfig = () => ({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

describe('Redis Integration Tests', () => {
  let client: RedisClientType;

  beforeAll(
    async () => {
      client = createClient(getRedisConfig()) as RedisClientType;
      await client.connect();
    },
    { timeout: TEST_TIMEOUT }
  );

  afterAll(async () => {
    if (client) {
      await client.quit();
    }
  });

  beforeEach(async () => {
    // Clear test keys before each test
    const keys = await client.keys('test:*');
    if (keys.length > 0) {
      await client.del(keys);
    }
  });

  describe('Connection', () => {
    it(
      'should connect to Redis successfully',
      async () => {
        const pong = await client.ping();
        expect(pong).toBe('PONG');
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should verify Redis version',
      async () => {
        const info = await client.info('server');
        expect(info).toContain('redis_version');
      },
      { timeout: TEST_TIMEOUT }
    );
  });

  describe('Basic Operations', () => {
    it(
      'should set and get string value',
      async () => {
        await client.set('test:key1', 'value1');
        const value = await client.get('test:key1');
        expect(value).toBe('value1');
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should set value with expiration',
      async () => {
        await client.set('test:expire', 'temporary', { EX: 2 });
        const value1 = await client.get('test:expire');
        expect(value1).toBe('temporary');

        // Wait for expiration
        await new Promise((resolve) => setTimeout(resolve, 2100));

        const value2 = await client.get('test:expire');
        expect(value2).toBeNull();
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should delete key',
      async () => {
        await client.set('test:delete', 'toDelete');
        await client.del('test:delete');
        const value = await client.get('test:delete');
        expect(value).toBeNull();
      },
      { timeout: TEST_TIMEOUT }
    );
  });

  describe('Prompt Cache', () => {
    it(
      'should cache prompt result',
      async () => {
        const promptKey = 'test:prompt:user123:greeting';
        const cacheValue = JSON.stringify({
          response: 'Hello! How can I help you?',
          model: 'gpt-4',
          timestamp: Date.now(),
        });

        await client.set(promptKey, cacheValue, { EX: 3600 });

        const cached = await client.get(promptKey);
        const parsed = JSON.parse(cached!);

        expect(parsed.response).toBe('Hello! How can I help you?');
        expect(parsed.model).toBe('gpt-4');
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should invalidate cache after TTL',
      async () => {
        const promptKey = 'test:prompt:short-ttl';
        await client.set(promptKey, 'cached-value', { EX: 1 });

        const value1 = await client.get(promptKey);
        expect(value1).toBe('cached-value');

        await new Promise((resolve) => setTimeout(resolve, 1100));

        const value2 = await client.get(promptKey);
        expect(value2).toBeNull();
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should handle cache miss',
      async () => {
        const value = await client.get('test:prompt:nonexistent');
        expect(value).toBeNull();
      },
      { timeout: TEST_TIMEOUT }
    );
  });

  describe('Semantic Cache', () => {
    it(
      'should store semantic cache with vector similarity',
      async () => {
        const cacheKey = 'test:semantic:query1';
        const cacheData = {
          query: 'What is the capital of France?',
          embedding: [0.1, 0.2, 0.3],
          response: 'The capital of France is Paris.',
          similarity_threshold: 0.95,
        };

        await client.hSet(cacheKey, {
          query: cacheData.query,
          embedding: JSON.stringify(cacheData.embedding),
          response: cacheData.response,
        });

        const cached = await client.hGetAll(cacheKey);

        expect(cached.query).toBe(cacheData.query);
        expect(cached.response).toBe(cacheData.response);
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should store multiple semantic cache entries',
      async () => {
        const entries = [
          { key: 'semantic:1', query: 'Query 1', response: 'Response 1' },
          { key: 'semantic:2', query: 'Query 2', response: 'Response 2' },
          { key: 'semantic:3', query: 'Query 3', response: 'Response 3' },
        ];

        for (const entry of entries) {
          await client.hSet(`test:${entry.key}`, {
            query: entry.query,
            response: entry.response,
          });
        }

        const keys = await client.keys('test:semantic:*');
        expect(keys.length).toBe(3);
      },
      { timeout: TEST_TIMEOUT }
    );
  });

  describe('Distributed Locks', () => {
    it(
      'should acquire lock',
      async () => {
        const lockKey = 'test:lock:resource1';
        const lockValue = 'lock-token-123';

        const acquired = await client.set(lockKey, lockValue, {
          NX: true,
          EX: 10,
        });

        expect(acquired).toBe('OK');

        await client.del(lockKey);
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should prevent concurrent lock acquisition',
      async () => {
        const lockKey = 'test:lock:resource2';
        const token1 = 'token-1';
        const token2 = 'token-2';

        // First lock should succeed
        const lock1 = await client.set(lockKey, token1, { NX: true, EX: 10 });
        expect(lock1).toBe('OK');

        // Second lock should fail
        const lock2 = await client.set(lockKey, token2, { NX: true, EX: 10 });
        expect(lock2).toBeNull();

        await client.del(lockKey);
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should release lock with correct token',
      async () => {
        const lockKey = 'test:lock:resource3';
        const token = 'correct-token';

        await client.set(lockKey, token, { NX: true, EX: 10 });

        // Verify lock exists
        const value = await client.get(lockKey);
        expect(value).toBe(token);

        // Release lock using Lua script (atomic check and delete)
        const script = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;

        const result = await client.eval(script, {
          keys: [lockKey],
          arguments: [token],
        });

        expect(result).toBe(1);

        const afterDelete = await client.get(lockKey);
        expect(afterDelete).toBeNull();
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should auto-release lock after TTL',
      async () => {
        const lockKey = 'test:lock:ttl';
        const token = 'ttl-token';

        await client.set(lockKey, token, { NX: true, EX: 1 });

        const value1 = await client.get(lockKey);
        expect(value1).toBe(token);

        await new Promise((resolve) => setTimeout(resolve, 1100));

        const value2 = await client.get(lockKey);
        expect(value2).toBeNull();
      },
      { timeout: TEST_TIMEOUT }
    );
  });

  describe('Pub/Sub', () => {
    it(
      'should publish and subscribe to messages',
      async () => {
        const channel = 'test:channel:updates';
        const subscriber = client.duplicate();
        await subscriber.connect();

        const messages: string[] = [];

        await subscriber.subscribe(channel, (message) => {
          messages.push(message);
        });

        // Give subscription time to register
        await new Promise((resolve) => setTimeout(resolve, 100));

        await client.publish(channel, 'message1');
        await client.publish(channel, 'message2');
        await client.publish(channel, 'message3');

        // Wait for messages to be received
        await new Promise((resolve) => setTimeout(resolve, 200));

        expect(messages.length).toBe(3);
        expect(messages).toContain('message1');
        expect(messages).toContain('message2');
        expect(messages).toContain('message3');

        await subscriber.unsubscribe(channel);
        await subscriber.quit();
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should support pattern subscriptions',
      async () => {
        const subscriber = client.duplicate();
        await subscriber.connect();

        const messages: { channel: string; message: string }[] = [];

        await subscriber.pSubscribe('test:events:*', (message, channel) => {
          messages.push({ channel, message });
        });

        await new Promise((resolve) => setTimeout(resolve, 100));

        await client.publish('test:events:user', 'user-event');
        await client.publish('test:events:system', 'system-event');

        await new Promise((resolve) => setTimeout(resolve, 200));

        expect(messages.length).toBe(2);

        await subscriber.pUnsubscribe('test:events:*');
        await subscriber.quit();
      },
      { timeout: TEST_TIMEOUT }
    );
  });

  describe('BullMQ Queue Simulation', () => {
    it(
      'should store job in queue',
      async () => {
        const queueKey = 'test:queue:jobs';
        const job = {
          id: 'job-1',
          type: 'execute-tool',
          data: { tool: 'search', params: { query: 'test' } },
          priority: 1,
          timestamp: Date.now(),
        };

        await client.lPush(queueKey, JSON.stringify(job));

        const queueLength = await client.lLen(queueKey);
        expect(queueLength).toBe(1);

        const retrieved = await client.rPop(queueKey);
        const parsedJob = JSON.parse(retrieved!);

        expect(parsedJob.id).toBe('job-1');
        expect(parsedJob.type).toBe('execute-tool');
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should process jobs in FIFO order',
      async () => {
        const queueKey = 'test:queue:fifo';
        const jobs = [
          { id: 'job-1', order: 1 },
          { id: 'job-2', order: 2 },
          { id: 'job-3', order: 3 },
        ];

        for (const job of jobs) {
          await client.lPush(queueKey, JSON.stringify(job));
        }

        const processed = [];
        while ((await client.lLen(queueKey)) > 0) {
          const job = await client.rPop(queueKey);
          processed.push(JSON.parse(job!));
        }

        expect(processed.map((j) => j.id)).toEqual(['job-1', 'job-2', 'job-3']);
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should track job status',
      async () => {
        const jobId = 'job-status-1';
        const statusKey = `test:job:${jobId}:status`;

        await client.hSet(statusKey, {
          status: 'pending',
          created_at: Date.now().toString(),
        });

        await client.hSet(statusKey, 'status', 'processing');
        await client.hSet(statusKey, 'started_at', Date.now().toString());

        await client.hSet(statusKey, 'status', 'completed');
        await client.hSet(statusKey, 'completed_at', Date.now().toString());

        const status = await client.hGetAll(statusKey);

        expect(status.status).toBe('completed');
        expect(status).toHaveProperty('created_at');
        expect(status).toHaveProperty('started_at');
        expect(status).toHaveProperty('completed_at');
      },
      { timeout: TEST_TIMEOUT }
    );
  });

  describe('Performance', () => {
    it(
      'should handle high throughput operations',
      async () => {
        const startTime = Date.now();
        const operations = 1000;

        const pipeline = client.multi();

        for (let i = 0; i < operations; i++) {
          pipeline.set(`test:perf:${i}`, `value-${i}`);
        }

        await pipeline.exec();

        const elapsed = Date.now() - startTime;

        expect(elapsed).toBeLessThan(5000); // Should complete in under 5 seconds

        // Cleanup
        const keys = await client.keys('test:perf:*');
        if (keys.length > 0) {
          await client.del(keys);
        }
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should support pipelining',
      async () => {
        const pipeline = client.multi();

        pipeline.set('test:pipe:1', 'value1');
        pipeline.set('test:pipe:2', 'value2');
        pipeline.get('test:pipe:1');
        pipeline.get('test:pipe:2');

        const results = await pipeline.exec();

        expect(results).toHaveLength(4);
      },
      { timeout: TEST_TIMEOUT }
    );
  });
});
