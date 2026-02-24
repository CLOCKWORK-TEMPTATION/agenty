/**
 * PostgreSQL Integration Tests
 * Tests real database connectivity and operations
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, Pool } from 'pg';

const TEST_TIMEOUT = 30000;

// Test database configuration
const getTestConfig = () => ({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'agents_test',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
});

describe('PostgreSQL Integration Tests', () => {
  let pool: Pool;
  let client: Client;

  beforeAll(
    async () => {
      // Create test database
      const adminClient = new Client({
        ...getTestConfig(),
        database: 'postgres',
      });

      try {
        await adminClient.connect();
        await adminClient.query(`DROP DATABASE IF EXISTS agents_test`);
        await adminClient.query(`CREATE DATABASE agents_test`);
      } catch (error) {
        console.error('Failed to setup test database:', error);
        throw error;
      } finally {
        await adminClient.end();
      }

      // Connect to test database
      pool = new Pool(getTestConfig());
      client = await pool.connect();
    },
    { timeout: TEST_TIMEOUT }
  );

  afterAll(async () => {
    if (client) {
      client.release();
    }
    if (pool) {
      await pool.end();
    }

    // Cleanup test database
    const adminClient = new Client({
      ...getTestConfig(),
      database: 'postgres',
    });

    try {
      await adminClient.connect();
      await adminClient.query(`DROP DATABASE IF EXISTS agents_test`);
    } catch (error) {
      console.error('Failed to cleanup test database:', error);
    } finally {
      await adminClient.end();
    }
  });

  describe('Connection', () => {
    it(
      'should connect to PostgreSQL successfully',
      async () => {
        const result = await client.query('SELECT 1 as value');
        expect(result.rows[0].value).toBe(1);
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should verify PostgreSQL version',
      async () => {
        const result = await client.query('SELECT version()');
        expect(result.rows[0].version).toContain('PostgreSQL');
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should handle connection pool',
      async () => {
        const poolSize = 5;
        const clients: Client[] = [];

        for (let i = 0; i < poolSize; i++) {
          const c = await pool.connect();
          clients.push(c);
        }

        expect(clients.length).toBe(poolSize);

        for (const c of clients) {
          c.release();
        }
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should handle connection errors gracefully',
      async () => {
        const badPool = new Pool({
          ...getTestConfig(),
          port: 9999, // Invalid port
        });

        await expect(badPool.query('SELECT 1')).rejects.toThrow();
        await badPool.end();
      },
      { timeout: TEST_TIMEOUT }
    );
  });

  describe('Basic Operations', () => {
    beforeAll(async () => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS test_users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
    });

    afterAll(async () => {
      await client.query('DROP TABLE IF EXISTS test_users');
    });

    it(
      'should insert data',
      async () => {
        const result = await client.query(
          `INSERT INTO test_users (name, email) VALUES ($1, $2) RETURNING id`,
          ['Test User', 'test@example.com']
        );

        expect(result.rows[0].id).toBeGreaterThan(0);
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should select data',
      async () => {
        await client.query(
          `INSERT INTO test_users (name, email) VALUES ($1, $2)`,
          ['John Doe', 'john@example.com']
        );

        const result = await client.query(
          `SELECT * FROM test_users WHERE email = $1`,
          ['john@example.com']
        );

        expect(result.rows[0].name).toBe('John Doe');
        expect(result.rows[0].email).toBe('john@example.com');
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should update data',
      async () => {
        const insertResult = await client.query(
          `INSERT INTO test_users (name, email) VALUES ($1, $2) RETURNING id`,
          ['Jane Doe', 'jane@example.com']
        );

        const userId = insertResult.rows[0].id;

        await client.query(
          `UPDATE test_users SET name = $1 WHERE id = $2`,
          ['Jane Smith', userId]
        );

        const selectResult = await client.query(
          `SELECT name FROM test_users WHERE id = $1`,
          [userId]
        );

        expect(selectResult.rows[0].name).toBe('Jane Smith');
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should delete data',
      async () => {
        const insertResult = await client.query(
          `INSERT INTO test_users (name, email) VALUES ($1, $2) RETURNING id`,
          ['To Delete', 'delete@example.com']
        );

        const userId = insertResult.rows[0].id;

        await client.query(`DELETE FROM test_users WHERE id = $1`, [userId]);

        const selectResult = await client.query(
          `SELECT * FROM test_users WHERE id = $1`,
          [userId]
        );

        expect(selectResult.rows.length).toBe(0);
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should enforce unique constraints',
      async () => {
        await client.query(
          `INSERT INTO test_users (name, email) VALUES ($1, $2)`,
          ['User 1', 'unique@example.com']
        );

        await expect(
          client.query(
            `INSERT INTO test_users (name, email) VALUES ($1, $2)`,
            ['User 2', 'unique@example.com']
          )
        ).rejects.toThrow();
      },
      { timeout: TEST_TIMEOUT }
    );
  });

  describe('Advanced Features', () => {
    it(
      'should support JSON/JSONB columns',
      async () => {
        await client.query(`
          CREATE TABLE IF NOT EXISTS test_json (
            id SERIAL PRIMARY KEY,
            data JSONB NOT NULL
          )
        `);

        const jsonData = { name: 'Test', tags: ['tag1', 'tag2'], count: 42 };

        await client.query(
          `INSERT INTO test_json (data) VALUES ($1)`,
          [JSON.stringify(jsonData)]
        );

        const result = await client.query(`SELECT data FROM test_json LIMIT 1`);

        expect(result.rows[0].data).toEqual(jsonData);

        await client.query('DROP TABLE IF EXISTS test_json');
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should support array columns',
      async () => {
        await client.query(`
          CREATE TABLE IF NOT EXISTS test_arrays (
            id SERIAL PRIMARY KEY,
            tags TEXT[]
          )
        `);

        const tags = ['javascript', 'typescript', 'nodejs'];

        await client.query(
          `INSERT INTO test_arrays (tags) VALUES ($1)`,
          [tags]
        );

        const result = await client.query(`SELECT tags FROM test_arrays LIMIT 1`);

        expect(result.rows[0].tags).toEqual(tags);

        await client.query('DROP TABLE IF EXISTS test_arrays');
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should support full-text search',
      async () => {
        await client.query(`
          CREATE TABLE IF NOT EXISTS test_search (
            id SERIAL PRIMARY KEY,
            content TEXT NOT NULL,
            search_vector TSVECTOR
          )
        `);

        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_search_vector ON test_search USING GIN(search_vector)
        `);

        const content = 'This is a test document about PostgreSQL full-text search';

        await client.query(
          `INSERT INTO test_search (content, search_vector)
           VALUES ($1, to_tsvector('english', $1))`,
          [content]
        );

        const result = await client.query(
          `SELECT content FROM test_search
           WHERE search_vector @@ to_tsquery('english', 'PostgreSQL & search')`
        );

        expect(result.rows.length).toBeGreaterThan(0);
        expect(result.rows[0].content).toContain('PostgreSQL');

        await client.query('DROP TABLE IF EXISTS test_search');
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should support triggers',
      async () => {
        await client.query(`
          CREATE TABLE IF NOT EXISTS test_audit (
            id SERIAL PRIMARY KEY,
            action VARCHAR(50),
            changed_at TIMESTAMP DEFAULT NOW()
          )
        `);

        await client.query(`
          CREATE TABLE IF NOT EXISTS test_data (
            id SERIAL PRIMARY KEY,
            value TEXT
          )
        `);

        await client.query(`
          CREATE OR REPLACE FUNCTION audit_trigger_func()
          RETURNS TRIGGER AS $$
          BEGIN
            INSERT INTO test_audit (action) VALUES (TG_OP);
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql
        `);

        await client.query(`
          CREATE TRIGGER audit_trigger
          AFTER INSERT OR UPDATE OR DELETE ON test_data
          FOR EACH ROW EXECUTE FUNCTION audit_trigger_func()
        `);

        await client.query(`INSERT INTO test_data (value) VALUES ('test')`);

        const result = await client.query(`SELECT action FROM test_audit`);

        expect(result.rows.length).toBeGreaterThan(0);
        expect(result.rows[0].action).toBe('INSERT');

        await client.query('DROP TABLE IF EXISTS test_data');
        await client.query('DROP TABLE IF EXISTS test_audit');
        await client.query('DROP FUNCTION IF EXISTS audit_trigger_func()');
      },
      { timeout: TEST_TIMEOUT }
    );
  });

  describe('Performance', () => {
    it(
      'should handle bulk inserts efficiently',
      async () => {
        await client.query(`
          CREATE TABLE IF NOT EXISTS test_bulk (
            id SERIAL PRIMARY KEY,
            value INTEGER
          )
        `);

        const startTime = Date.now();
        const batchSize = 1000;

        // Use COPY for bulk insert
        const values = Array.from({ length: batchSize }, (_, i) => `(${i})`).join(',');
        await client.query(`INSERT INTO test_bulk (value) VALUES ${values}`);

        const elapsed = Date.now() - startTime;

        const countResult = await client.query(`SELECT COUNT(*) FROM test_bulk`);
        expect(parseInt(countResult.rows[0].count)).toBe(batchSize);

        // Should complete in reasonable time (less than 5 seconds)
        expect(elapsed).toBeLessThan(5000);

        await client.query('DROP TABLE IF EXISTS test_bulk');
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should use indexes effectively',
      async () => {
        await client.query(`
          CREATE TABLE IF NOT EXISTS test_index (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255)
          )
        `);

        // Insert test data
        for (let i = 0; i < 100; i++) {
          await client.query(
            `INSERT INTO test_index (email) VALUES ($1)`,
            [`user${i}@example.com`]
          );
        }

        // Create index
        await client.query(`CREATE INDEX idx_email ON test_index(email)`);

        // Test query with EXPLAIN
        const explainResult = await client.query(
          `EXPLAIN SELECT * FROM test_index WHERE email = $1`,
          ['user50@example.com']
        );

        expect(explainResult.rows.length).toBeGreaterThan(0);

        await client.query('DROP TABLE IF EXISTS test_index');
      },
      { timeout: TEST_TIMEOUT }
    );
  });
});
