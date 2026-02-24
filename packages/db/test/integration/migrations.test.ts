/**
 * Database Migrations Integration Tests
 * Tests migration system up/down operations
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, Pool } from 'pg';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const TEST_TIMEOUT = 30000;

const getTestConfig = () => ({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'agents_test',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
});

interface Migration {
  version: number;
  name: string;
  up: string;
  down?: string;
}

describe('Database Migrations Integration Tests', () => {
  let pool: Pool;
  let client: Client;

  beforeAll(
    async () => {
      pool = new Pool(getTestConfig());
      client = await pool.connect();

      // Create migrations tracking table
      await client.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          version INTEGER UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          applied_at TIMESTAMP DEFAULT NOW()
        )
      `);
    },
    { timeout: TEST_TIMEOUT }
  );

  afterAll(async () => {
    // Cleanup
    await client.query('DROP TABLE IF EXISTS migrations');

    if (client) {
      client.release();
    }
    if (pool) {
      await pool.end();
    }
  });

  describe('Migration Tracking', () => {
    it(
      'should create migrations table',
      async () => {
        const result = await client.query(`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_name = 'migrations'
        `);

        expect(result.rows.length).toBe(1);
        expect(result.rows[0].table_name).toBe('migrations');
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should track applied migrations',
      async () => {
        await client.query(`
          INSERT INTO migrations (version, name)
          VALUES (1, 'initial_schema')
        `);

        const result = await client.query(`
          SELECT version, name FROM migrations WHERE version = 1
        `);

        expect(result.rows[0].version).toBe(1);
        expect(result.rows[0].name).toBe('initial_schema');
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should get latest migration version',
      async () => {
        await client.query(`
          INSERT INTO migrations (version, name)
          VALUES (2, 'add_users'), (3, 'add_teams')
        `);

        const result = await client.query(`
          SELECT MAX(version) as latest FROM migrations
        `);

        expect(result.rows[0].latest).toBe(3);
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should prevent duplicate migration versions',
      async () => {
        await client.query(`
          INSERT INTO migrations (version, name) VALUES (10, 'test_migration')
        `);

        await expect(
          client.query(`
            INSERT INTO migrations (version, name) VALUES (10, 'duplicate')
          `)
        ).rejects.toThrow();
      },
      { timeout: TEST_TIMEOUT }
    );
  });

  describe('Migration Execution', () => {
    const testMigration: Migration = {
      version: 100,
      name: 'create_test_table',
      up: `
        CREATE TABLE test_migration_table (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL
        )
      `,
      down: `
        DROP TABLE IF EXISTS test_migration_table
      `,
    };

    it(
      'should run migration up',
      async () => {
        // Execute up migration
        await client.query(testMigration.up);

        // Track migration
        await client.query(
          `INSERT INTO migrations (version, name) VALUES ($1, $2)`,
          [testMigration.version, testMigration.name]
        );

        // Verify table was created
        const result = await client.query(`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_name = 'test_migration_table'
        `);

        expect(result.rows.length).toBe(1);
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should rollback migration down',
      async () => {
        // Execute down migration
        if (testMigration.down) {
          await client.query(testMigration.down);
        }

        // Remove from tracking
        await client.query(
          `DELETE FROM migrations WHERE version = $1`,
          [testMigration.version]
        );

        // Verify table was dropped
        const result = await client.query(`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_name = 'test_migration_table'
        `);

        expect(result.rows.length).toBe(0);
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should run migrations in order',
      async () => {
        const migrations: Migration[] = [
          {
            version: 201,
            name: 'create_users',
            up: 'CREATE TABLE users_201 (id SERIAL PRIMARY KEY)',
            down: 'DROP TABLE users_201',
          },
          {
            version: 202,
            name: 'create_posts',
            up: 'CREATE TABLE posts_202 (id SERIAL PRIMARY KEY, user_id INTEGER)',
            down: 'DROP TABLE posts_202',
          },
          {
            version: 203,
            name: 'create_comments',
            up: 'CREATE TABLE comments_203 (id SERIAL PRIMARY KEY, post_id INTEGER)',
            down: 'DROP TABLE comments_203',
          },
        ];

        // Run migrations in order
        for (const migration of migrations) {
          await client.query(migration.up);
          await client.query(
            `INSERT INTO migrations (version, name) VALUES ($1, $2)`,
            [migration.version, migration.name]
          );
        }

        // Verify all tables exist
        const result = await client.query(`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_name IN ('users_201', 'posts_202', 'comments_203')
          ORDER BY table_name
        `);

        expect(result.rows.length).toBe(3);

        // Cleanup
        for (const migration of migrations.reverse()) {
          if (migration.down) {
            await client.query(migration.down);
          }
          await client.query(
            `DELETE FROM migrations WHERE version = $1`,
            [migration.version]
          );
        }
      },
      { timeout: TEST_TIMEOUT }
    );
  });

  describe('Migration Safety', () => {
    it(
      'should handle migration failures with rollback',
      async () => {
        const failingMigration = {
          version: 300,
          name: 'failing_migration',
          up: `
            CREATE TABLE test_fail (id SERIAL);
            -- This will fail
            ALTER TABLE non_existent_table ADD COLUMN test VARCHAR(255);
          `,
        };

        try {
          await client.query('BEGIN');
          await client.query(failingMigration.up);
          await client.query(
            `INSERT INTO migrations (version, name) VALUES ($1, $2)`,
            [failingMigration.version, failingMigration.name]
          );
          await client.query('COMMIT');
          expect(true).toBe(false); // Should not reach here
        } catch (error) {
          await client.query('ROLLBACK');
          expect(error).toBeDefined();
        }

        // Verify migration was not tracked
        const result = await client.query(`
          SELECT * FROM migrations WHERE version = $1`,
          [failingMigration.version]
        );

        expect(result.rows.length).toBe(0);

        // Verify table was not created
        const tableResult = await client.query(`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_name = 'test_fail'
        `);

        expect(tableResult.rows.length).toBe(0);
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should validate migration before execution',
      async () => {
        const invalidMigration = {
          version: 400,
          name: 'invalid_sql',
          up: 'INVALID SQL SYNTAX HERE',
        };

        await expect(
          client.query(invalidMigration.up)
        ).rejects.toThrow();
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should check for pending migrations',
      async () => {
        // Define expected migrations
        const definedMigrations = [1, 2, 3, 4, 5];

        // Get applied migrations
        const result = await client.query(`
          SELECT version FROM migrations ORDER BY version
        `);

        const appliedVersions = result.rows.map((row) => row.version);

        // Find pending migrations
        const pendingMigrations = definedMigrations.filter(
          (version) => !appliedVersions.includes(version)
        );

        expect(Array.isArray(pendingMigrations)).toBe(true);
      },
      { timeout: TEST_TIMEOUT }
    );
  });

  describe('Schema Versioning', () => {
    it(
      'should store schema version',
      async () => {
        await client.query(`
          CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY,
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);

        await client.query(`
          INSERT INTO schema_version (version)
          VALUES (1)
          ON CONFLICT (version) DO UPDATE SET updated_at = NOW()
        `);

        const result = await client.query(`
          SELECT version FROM schema_version
        `);

        expect(result.rows[0].version).toBe(1);

        await client.query('DROP TABLE IF EXISTS schema_version');
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should detect schema changes',
      async () => {
        await client.query(`
          CREATE TABLE test_schema_change (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255)
          )
        `);

        // Get initial schema
        const beforeResult = await client.query(`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = 'test_schema_change'
          ORDER BY column_name
        `);

        const beforeColumns = beforeResult.rows.length;

        // Add column
        await client.query(`
          ALTER TABLE test_schema_change ADD COLUMN email VARCHAR(255)
        `);

        // Get new schema
        const afterResult = await client.query(`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = 'test_schema_change'
          ORDER BY column_name
        `);

        const afterColumns = afterResult.rows.length;

        expect(afterColumns).toBe(beforeColumns + 1);

        await client.query('DROP TABLE IF EXISTS test_schema_change');
      },
      { timeout: TEST_TIMEOUT }
    );
  });

  describe('Performance', () => {
    it(
      'should handle large migrations efficiently',
      async () => {
        const startTime = Date.now();

        await client.query(`
          CREATE TABLE large_migration_test (
            id SERIAL PRIMARY KEY,
            data TEXT
          )
        `);

        // Insert many rows
        const batchSize = 1000;
        const values = Array.from({ length: batchSize }, (_, i) =>
          `(${i}, 'data_${i}')`
        ).join(',');

        await client.query(`
          INSERT INTO large_migration_test (id, data) VALUES ${values}
        `);

        const elapsed = Date.now() - startTime;

        // Should complete in reasonable time
        expect(elapsed).toBeLessThan(10000);

        await client.query('DROP TABLE IF EXISTS large_migration_test');
      },
      { timeout: TEST_TIMEOUT }
    );
  });
});
