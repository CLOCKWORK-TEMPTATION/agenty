/**
 * pgvector Integration Tests
 * Tests vector operations with pgvector extension
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, Pool } from 'pg';

const TEST_TIMEOUT = 30000;

const getTestConfig = () => ({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'agents_test',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
});

describe('pgvector Integration Tests', () => {
  let pool: Pool;
  let client: Client;

  beforeAll(
    async () => {
      pool = new Pool(getTestConfig());
      client = await pool.connect();

      // Enable pgvector extension
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');
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
  });

  describe('Extension Setup', () => {
    it(
      'should have pgvector extension installed',
      async () => {
        const result = await client.query(
          `SELECT * FROM pg_extension WHERE extname = 'vector'`
        );

        expect(result.rows.length).toBe(1);
        expect(result.rows[0].extname).toBe('vector');
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should create table with vector column',
      async () => {
        await client.query(`
          CREATE TABLE IF NOT EXISTS test_embeddings (
            id SERIAL PRIMARY KEY,
            content TEXT NOT NULL,
            embedding vector(1536)
          )
        `);

        const result = await client.query(`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = 'test_embeddings' AND column_name = 'embedding'
        `);

        expect(result.rows.length).toBe(1);

        await client.query('DROP TABLE IF EXISTS test_embeddings');
      },
      { timeout: TEST_TIMEOUT }
    );
  });

  describe('Vector Operations', () => {
    beforeAll(async () => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS test_vectors (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          embedding vector(3)
        )
      `);
    });

    afterAll(async () => {
      await client.query('DROP TABLE IF EXISTS test_vectors');
    });

    it(
      'should insert vector data',
      async () => {
        const vector = [0.1, 0.2, 0.3];

        const result = await client.query(
          `INSERT INTO test_vectors (name, embedding) VALUES ($1, $2) RETURNING id`,
          ['test_vector', JSON.stringify(vector)]
        );

        expect(result.rows[0].id).toBeGreaterThan(0);
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should retrieve vector data',
      async () => {
        const vector = [0.4, 0.5, 0.6];

        await client.query(
          `INSERT INTO test_vectors (name, embedding) VALUES ($1, $2)`,
          ['retrieve_test', JSON.stringify(vector)]
        );

        const result = await client.query(
          `SELECT embedding FROM test_vectors WHERE name = $1`,
          ['retrieve_test']
        );

        expect(result.rows[0].embedding).toBeDefined();
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should calculate L2 distance',
      async () => {
        const vector1 = [1.0, 0.0, 0.0];
        const vector2 = [0.0, 1.0, 0.0];

        await client.query(
          `INSERT INTO test_vectors (name, embedding) VALUES ($1, $2), ($3, $4)`,
          ['v1', JSON.stringify(vector1), 'v2', JSON.stringify(vector2)]
        );

        const result = await client.query(`
          SELECT
            v1.name as name1,
            v2.name as name2,
            v1.embedding <-> v2.embedding as distance
          FROM test_vectors v1, test_vectors v2
          WHERE v1.name = 'v1' AND v2.name = 'v2'
        `);

        expect(result.rows[0].distance).toBeGreaterThan(0);
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should calculate cosine similarity',
      async () => {
        const vector1 = [1.0, 1.0, 1.0];
        const vector2 = [2.0, 2.0, 2.0];

        await client.query(
          `INSERT INTO test_vectors (name, embedding) VALUES ($1, $2), ($3, $4)`,
          ['cos1', JSON.stringify(vector1), 'cos2', JSON.stringify(vector2)]
        );

        const result = await client.query(`
          SELECT
            v1.embedding <=> v2.embedding as cosine_distance
          FROM test_vectors v1, test_vectors v2
          WHERE v1.name = 'cos1' AND v2.name = 'cos2'
        `);

        // Cosine distance should be very small for similar direction vectors
        expect(result.rows[0].cosine_distance).toBeLessThan(0.1);
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should calculate inner product',
      async () => {
        const vector1 = [1.0, 2.0, 3.0];
        const vector2 = [4.0, 5.0, 6.0];

        await client.query(
          `INSERT INTO test_vectors (name, embedding) VALUES ($1, $2), ($3, $4)`,
          ['ip1', JSON.stringify(vector1), 'ip2', JSON.stringify(vector2)]
        );

        const result = await client.query(`
          SELECT
            v1.embedding <#> v2.embedding as inner_product
          FROM test_vectors v1, test_vectors v2
          WHERE v1.name = 'ip1' AND v2.name = 'ip2'
        `);

        expect(result.rows[0].inner_product).toBeDefined();
      },
      { timeout: TEST_TIMEOUT }
    );
  });

  describe('Vector Search', () => {
    beforeAll(async () => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS test_search_vectors (
          id SERIAL PRIMARY KEY,
          content TEXT,
          embedding vector(3)
        )
      `);

      // Insert sample vectors
      const samples = [
        { content: 'red', vector: [1.0, 0.0, 0.0] },
        { content: 'green', vector: [0.0, 1.0, 0.0] },
        { content: 'blue', vector: [0.0, 0.0, 1.0] },
        { content: 'yellow', vector: [1.0, 1.0, 0.0] },
        { content: 'purple', vector: [1.0, 0.0, 1.0] },
      ];

      for (const sample of samples) {
        await client.query(
          `INSERT INTO test_search_vectors (content, embedding) VALUES ($1, $2)`,
          [sample.content, JSON.stringify(sample.vector)]
        );
      }
    });

    afterAll(async () => {
      await client.query('DROP TABLE IF EXISTS test_search_vectors');
    });

    it(
      'should find nearest neighbors',
      async () => {
        const queryVector = [1.0, 0.1, 0.0]; // Close to red

        const result = await client.query(
          `
          SELECT content, embedding <-> $1 as distance
          FROM test_search_vectors
          ORDER BY distance
          LIMIT 3
          `,
          [JSON.stringify(queryVector)]
        );

        expect(result.rows.length).toBe(3);
        expect(result.rows[0].content).toBe('red'); // Should be closest
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should filter with WHERE clause and vector search',
      async () => {
        const queryVector = [0.5, 0.5, 0.5];

        const result = await client.query(
          `
          SELECT content, embedding <-> $1 as distance
          FROM test_search_vectors
          WHERE content IN ('red', 'green', 'blue')
          ORDER BY distance
          LIMIT 2
          `,
          [JSON.stringify(queryVector)]
        );

        expect(result.rows.length).toBe(2);
      },
      { timeout: TEST_TIMEOUT }
    );
  });

  describe('Vector Indexes', () => {
    beforeAll(async () => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS test_indexed_vectors (
          id SERIAL PRIMARY KEY,
          embedding vector(3)
        )
      `);

      // Insert sample data
      for (let i = 0; i < 100; i++) {
        const vector = [
          Math.random(),
          Math.random(),
          Math.random(),
        ];
        await client.query(
          `INSERT INTO test_indexed_vectors (embedding) VALUES ($1)`,
          [JSON.stringify(vector)]
        );
      }
    });

    afterAll(async () => {
      await client.query('DROP TABLE IF EXISTS test_indexed_vectors');
    });

    it(
      'should create IVFFlat index',
      async () => {
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_ivfflat
          ON test_indexed_vectors
          USING ivfflat (embedding vector_l2_ops)
          WITH (lists = 10)
        `);

        const result = await client.query(`
          SELECT indexname
          FROM pg_indexes
          WHERE tablename = 'test_indexed_vectors' AND indexname = 'idx_ivfflat'
        `);

        expect(result.rows.length).toBe(1);
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should use index for similarity search',
      async () => {
        const queryVector = [0.5, 0.5, 0.5];

        const result = await client.query(
          `
          SELECT id, embedding <-> $1 as distance
          FROM test_indexed_vectors
          ORDER BY distance
          LIMIT 5
          `,
          [JSON.stringify(queryVector)]
        );

        expect(result.rows.length).toBe(5);
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should create HNSW index',
      async () => {
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_hnsw
          ON test_indexed_vectors
          USING hnsw (embedding vector_l2_ops)
        `);

        const result = await client.query(`
          SELECT indexname
          FROM pg_indexes
          WHERE tablename = 'test_indexed_vectors' AND indexname = 'idx_hnsw'
        `);

        expect(result.rows.length).toBe(1);
      },
      { timeout: TEST_TIMEOUT }
    );
  });

  describe('High-Dimensional Vectors', () => {
    it(
      'should handle 1536-dimensional vectors (OpenAI embeddings)',
      async () => {
        await client.query(`
          CREATE TABLE IF NOT EXISTS test_high_dim (
            id SERIAL PRIMARY KEY,
            embedding vector(1536)
          )
        `);

        const vector = new Array(1536).fill(0).map(() => Math.random());

        await client.query(
          `INSERT INTO test_high_dim (embedding) VALUES ($1)`,
          [JSON.stringify(vector)]
        );

        const result = await client.query(`SELECT COUNT(*) FROM test_high_dim`);
        expect(parseInt(result.rows[0].count)).toBe(1);

        await client.query('DROP TABLE IF EXISTS test_high_dim');
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should perform similarity search on high-dimensional vectors',
      async () => {
        await client.query(`
          CREATE TABLE IF NOT EXISTS test_high_dim_search (
            id SERIAL PRIMARY KEY,
            content TEXT,
            embedding vector(384)
          )
        `);

        // Insert sample vectors
        for (let i = 0; i < 10; i++) {
          const vector = new Array(384).fill(0).map(() => Math.random());
          await client.query(
            `INSERT INTO test_high_dim_search (content, embedding) VALUES ($1, $2)`,
            [`document_${i}`, JSON.stringify(vector)]
          );
        }

        const queryVector = new Array(384).fill(0).map(() => Math.random());

        const result = await client.query(
          `
          SELECT content, embedding <-> $1 as distance
          FROM test_high_dim_search
          ORDER BY distance
          LIMIT 5
          `,
          [JSON.stringify(queryVector)]
        );

        expect(result.rows.length).toBe(5);

        await client.query('DROP TABLE IF EXISTS test_high_dim_search');
      },
      { timeout: TEST_TIMEOUT }
    );
  });

  describe('Performance', () => {
    it(
      'should handle concurrent vector searches',
      async () => {
        await client.query(`
          CREATE TABLE IF NOT EXISTS test_concurrent (
            id SERIAL PRIMARY KEY,
            embedding vector(3)
          )
        `);

        // Insert vectors
        for (let i = 0; i < 50; i++) {
          const vector = [Math.random(), Math.random(), Math.random()];
          await client.query(
            `INSERT INTO test_concurrent (embedding) VALUES ($1)`,
            [JSON.stringify(vector)]
          );
        }

        // Perform concurrent searches
        const searches = [];
        for (let i = 0; i < 10; i++) {
          const queryVector = [Math.random(), Math.random(), Math.random()];
          searches.push(
            client.query(
              `SELECT embedding <-> $1 as distance FROM test_concurrent ORDER BY distance LIMIT 5`,
              [JSON.stringify(queryVector)]
            )
          );
        }

        const results = await Promise.all(searches);
        expect(results.length).toBe(10);
        results.forEach((result) => {
          expect(result.rows.length).toBe(5);
        });

        await client.query('DROP TABLE IF EXISTS test_concurrent');
      },
      { timeout: TEST_TIMEOUT }
    );
  });
});
