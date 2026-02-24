/**
 * LangGraph Checkpoints Integration Tests
 * Tests checkpoint persistence and recovery
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Client, Pool } from 'pg';

const TEST_TIMEOUT = 30000;

const getTestConfig = () => ({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'agents_test',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
});

interface Checkpoint {
  thread_id: string;
  checkpoint_id: string;
  parent_checkpoint_id: string | null;
  checkpoint_data: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

describe('LangGraph Checkpoints Integration Tests', () => {
  let pool: Pool;
  let client: Client;

  beforeAll(
    async () => {
      pool = new Pool(getTestConfig());
      client = await pool.connect();

      // Create checkpoints table
      await client.query(`
        CREATE TABLE IF NOT EXISTS checkpoints (
          id SERIAL PRIMARY KEY,
          thread_id VARCHAR(255) NOT NULL,
          checkpoint_id VARCHAR(255) NOT NULL,
          parent_checkpoint_id VARCHAR(255),
          checkpoint_data JSONB NOT NULL,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(thread_id, checkpoint_id)
        )
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_thread_id ON checkpoints(thread_id)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_checkpoint_id ON checkpoints(checkpoint_id)
      `);
    },
    { timeout: TEST_TIMEOUT }
  );

  afterAll(async () => {
    await client.query('DROP TABLE IF EXISTS checkpoints');

    if (client) {
      client.release();
    }
    if (pool) {
      await pool.end();
    }
  });

  beforeEach(async () => {
    await client.query('TRUNCATE checkpoints RESTART IDENTITY');
  });

  describe('Checkpoint Creation', () => {
    it(
      'should save checkpoint',
      async () => {
        const checkpoint: Checkpoint = {
          thread_id: 'thread-001',
          checkpoint_id: 'ckpt-001',
          parent_checkpoint_id: null,
          checkpoint_data: {
            state: { current_node: 'intake', values: { user_id: '123' } },
            next: ['profile'],
          },
          metadata: { step: 1, timestamp: new Date().toISOString() },
        };

        await client.query(
          `INSERT INTO checkpoints (thread_id, checkpoint_id, parent_checkpoint_id, checkpoint_data, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            checkpoint.thread_id,
            checkpoint.checkpoint_id,
            checkpoint.parent_checkpoint_id,
            JSON.stringify(checkpoint.checkpoint_data),
            JSON.stringify(checkpoint.metadata),
          ]
        );

        const result = await client.query(
          `SELECT * FROM checkpoints WHERE thread_id = $1`,
          [checkpoint.thread_id]
        );

        expect(result.rows.length).toBe(1);
        expect(result.rows[0].checkpoint_id).toBe('ckpt-001');
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should save checkpoint with parent',
      async () => {
        // Save parent checkpoint
        await client.query(
          `INSERT INTO checkpoints (thread_id, checkpoint_id, checkpoint_data)
           VALUES ($1, $2, $3)`,
          ['thread-002', 'ckpt-parent', JSON.stringify({ state: 'initial' })]
        );

        // Save child checkpoint
        await client.query(
          `INSERT INTO checkpoints (thread_id, checkpoint_id, parent_checkpoint_id, checkpoint_data)
           VALUES ($1, $2, $3, $4)`,
          [
            'thread-002',
            'ckpt-child',
            'ckpt-parent',
            JSON.stringify({ state: 'updated' }),
          ]
        );

        const result = await client.query(
          `SELECT * FROM checkpoints WHERE thread_id = $1 ORDER BY id`,
          ['thread-002']
        );

        expect(result.rows.length).toBe(2);
        expect(result.rows[1].parent_checkpoint_id).toBe('ckpt-parent');
      },
      { timeout: TEST_TIMEOUT }
    );
  });

  describe('Checkpoint Retrieval', () => {
    beforeEach(async () => {
      // Setup test data
      await client.query(
        `INSERT INTO checkpoints (thread_id, checkpoint_id, checkpoint_data, metadata)
         VALUES
         ('thread-003', 'ckpt-1', $1, $2),
         ('thread-003', 'ckpt-2', $1, $2),
         ('thread-003', 'ckpt-3', $1, $2)`,
        [JSON.stringify({ state: 'test' }), JSON.stringify({ step: 1 })]
      );
    });

    it(
      'should retrieve latest checkpoint',
      async () => {
        const result = await client.query(
          `SELECT * FROM checkpoints
           WHERE thread_id = $1
           ORDER BY created_at DESC
           LIMIT 1`,
          ['thread-003']
        );

        expect(result.rows.length).toBe(1);
        expect(result.rows[0].checkpoint_id).toBe('ckpt-3');
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should retrieve checkpoint by ID',
      async () => {
        const result = await client.query(
          `SELECT * FROM checkpoints WHERE checkpoint_id = $1`,
          ['ckpt-2']
        );

        expect(result.rows.length).toBe(1);
        expect(result.rows[0].checkpoint_id).toBe('ckpt-2');
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should retrieve all checkpoints for thread',
      async () => {
        const result = await client.query(
          `SELECT * FROM checkpoints WHERE thread_id = $1 ORDER BY created_at`,
          ['thread-003']
        );

        expect(result.rows.length).toBe(3);
      },
      { timeout: TEST_TIMEOUT }
    );
  });

  describe('Checkpoint Chain', () => {
    it(
      'should build checkpoint chain',
      async () => {
        const checkpoints = [
          { id: 'ckpt-1', parent: null, data: { step: 1 } },
          { id: 'ckpt-2', parent: 'ckpt-1', data: { step: 2 } },
          { id: 'ckpt-3', parent: 'ckpt-2', data: { step: 3 } },
          { id: 'ckpt-4', parent: 'ckpt-3', data: { step: 4 } },
        ];

        for (const ckpt of checkpoints) {
          await client.query(
            `INSERT INTO checkpoints (thread_id, checkpoint_id, parent_checkpoint_id, checkpoint_data)
             VALUES ($1, $2, $3, $4)`,
            ['thread-004', ckpt.id, ckpt.parent, JSON.stringify(ckpt.data)]
          );
        }

        // Retrieve chain using recursive CTE
        const result = await client.query(
          `WITH RECURSIVE checkpoint_chain AS (
             SELECT * FROM checkpoints WHERE checkpoint_id = 'ckpt-4'
             UNION ALL
             SELECT c.* FROM checkpoints c
             INNER JOIN checkpoint_chain cc ON c.checkpoint_id = cc.parent_checkpoint_id
           )
           SELECT * FROM checkpoint_chain ORDER BY created_at`,
          []
        );

        expect(result.rows.length).toBe(4);
      },
      { timeout: TEST_TIMEOUT }
    );
  });

  describe('Checkpoint Resume', () => {
    it(
      'should resume from checkpoint',
      async () => {
        // Save checkpoint at specific state
        const checkpointData = {
          state: {
            current_node: 'planner',
            values: {
              plan: ['step1', 'step2', 'step3'],
              completed: ['step1'],
            },
          },
          next: ['specialists_parallel'],
        };

        await client.query(
          `INSERT INTO checkpoints (thread_id, checkpoint_id, checkpoint_data)
           VALUES ($1, $2, $3)`,
          ['thread-resume-001', 'ckpt-resume', JSON.stringify(checkpointData)]
        );

        // Retrieve and resume
        const result = await client.query(
          `SELECT checkpoint_data FROM checkpoints WHERE checkpoint_id = $1`,
          ['ckpt-resume']
        );

        const retrieved = result.rows[0].checkpoint_data;

        expect(retrieved.state.current_node).toBe('planner');
        expect(retrieved.next).toEqual(['specialists_parallel']);
        expect(retrieved.state.values.completed).toContain('step1');
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should resume from approval gate interrupt',
      async () => {
        const interruptCheckpoint = {
          state: {
            current_node: 'approval_gate',
            values: {
              draft_team: { /* team config */ },
              awaiting_approval: true,
            },
          },
          next: [],
          interrupted: true,
        };

        await client.query(
          `INSERT INTO checkpoints (thread_id, checkpoint_id, checkpoint_data, metadata)
           VALUES ($1, $2, $3, $4)`,
          [
            'thread-approval',
            'ckpt-interrupt',
            JSON.stringify(interruptCheckpoint),
            JSON.stringify({ interrupt_reason: 'human_approval_required' }),
          ]
        );

        const result = await client.query(
          `SELECT * FROM checkpoints WHERE thread_id = $1`,
          ['thread-approval']
        );

        expect(result.rows[0].checkpoint_data.interrupted).toBe(true);
        expect(result.rows[0].metadata.interrupt_reason).toBe(
          'human_approval_required'
        );
      },
      { timeout: TEST_TIMEOUT }
    );
  });

  describe('Checkpoint Cleanup', () => {
    it(
      'should delete old checkpoints',
      async () => {
        // Insert old and new checkpoints
        await client.query(
          `INSERT INTO checkpoints (thread_id, checkpoint_id, checkpoint_data, created_at)
           VALUES
           ('thread-old', 'ckpt-old', $1, NOW() - INTERVAL '30 days'),
           ('thread-new', 'ckpt-new', $1, NOW())`,
          [JSON.stringify({ state: 'test' })]
        );

        // Delete checkpoints older than 7 days
        await client.query(
          `DELETE FROM checkpoints WHERE created_at < NOW() - INTERVAL '7 days'`
        );

        const result = await client.query(`SELECT * FROM checkpoints`);

        expect(result.rows.length).toBe(1);
        expect(result.rows[0].checkpoint_id).toBe('ckpt-new');
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should keep only latest N checkpoints per thread',
      async () => {
        const maxCheckpoints = 5;

        // Insert 10 checkpoints
        for (let i = 1; i <= 10; i++) {
          await client.query(
            `INSERT INTO checkpoints (thread_id, checkpoint_id, checkpoint_data)
             VALUES ($1, $2, $3)`,
            [
              'thread-limit',
              `ckpt-${i}`,
              JSON.stringify({ step: i }),
            ]
          );
        }

        // Delete all but latest 5
        await client.query(
          `DELETE FROM checkpoints
           WHERE id NOT IN (
             SELECT id FROM checkpoints
             WHERE thread_id = 'thread-limit'
             ORDER BY created_at DESC
             LIMIT $1
           ) AND thread_id = 'thread-limit'`,
          [maxCheckpoints]
        );

        const result = await client.query(
          `SELECT * FROM checkpoints WHERE thread_id = 'thread-limit' ORDER BY created_at`
        );

        expect(result.rows.length).toBe(maxCheckpoints);
        expect(result.rows[0].checkpoint_id).toBe('ckpt-6');
        expect(result.rows[4].checkpoint_id).toBe('ckpt-10');
      },
      { timeout: TEST_TIMEOUT }
    );
  });

  describe('Performance', () => {
    it(
      'should handle rapid checkpoint creation',
      async () => {
        const startTime = Date.now();
        const checkpointCount = 100;

        for (let i = 0; i < checkpointCount; i++) {
          await client.query(
            `INSERT INTO checkpoints (thread_id, checkpoint_id, checkpoint_data)
             VALUES ($1, $2, $3)`,
            [
              `thread-perf-${i % 10}`,
              `ckpt-${i}`,
              JSON.stringify({ step: i, data: `data_${i}` }),
            ]
          );
        }

        const elapsed = Date.now() - startTime;

        const result = await client.query(`SELECT COUNT(*) FROM checkpoints`);
        expect(parseInt(result.rows[0].count)).toBe(checkpointCount);
        expect(elapsed).toBeLessThan(10000); // Should complete in under 10 seconds
      },
      { timeout: TEST_TIMEOUT }
    );
  });
});
