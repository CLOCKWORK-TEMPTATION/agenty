/**
 * RBAC End-to-End Integration Tests
 * Tests Role-Based Access Control with real database
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

describe('RBAC Integration Tests', () => {
  let pool: Pool;
  let client: Client;

  beforeAll(async () => {
    pool = new Pool(getTestConfig());
    client = await pool.connect();

    // Create RBAC tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(50) NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id SERIAL PRIMARY KEY,
        role VARCHAR(50) NOT NULL,
        resource VARCHAR(100) NOT NULL,
        action VARCHAR(50) NOT NULL,
        UNIQUE(role, resource, action)
      )
    `);
  }, { timeout: TEST_TIMEOUT });

  afterAll(async () => {
    await client.query('DROP TABLE IF EXISTS users CASCADE');
    await client.query('DROP TABLE IF EXISTS permissions');
    if (client) client.release();
    if (pool) await pool.end();
  });

  beforeEach(async () => {
    await client.query('TRUNCATE users, permissions RESTART IDENTITY');
  });

  describe('User Roles', () => {
    it('should assign role to user', async () => {
      await client.query(
        `INSERT INTO users (email, role) VALUES ($1, $2)`,
        ['admin@example.com', 'admin']
      );

      const result = await client.query(
        `SELECT role FROM users WHERE email = $1`,
        ['admin@example.com']
      );

      expect(result.rows[0].role).toBe('admin');
    }, { timeout: TEST_TIMEOUT });

    it('should support multiple user roles', async () => {
      const users = [
        { email: 'admin@example.com', role: 'admin' },
        { email: 'user@example.com', role: 'user' },
        { email: 'viewer@example.com', role: 'viewer' },
      ];

      for (const user of users) {
        await client.query(
          `INSERT INTO users (email, role) VALUES ($1, $2)`,
          [user.email, user.role]
        );
      }

      const result = await client.query(`SELECT role, COUNT(*) FROM users GROUP BY role`);
      expect(result.rows.length).toBe(3);
    }, { timeout: TEST_TIMEOUT });
  });

  describe('Permissions', () => {
    it('should grant permission to role', async () => {
      await client.query(
        `INSERT INTO permissions (role, resource, action) VALUES ($1, $2, $3)`,
        ['admin', 'teams', 'create']
      );

      const result = await client.query(
        `SELECT * FROM permissions WHERE role = $1`,
        ['admin']
      );

      expect(result.rows[0].resource).toBe('teams');
      expect(result.rows[0].action).toBe('create');
    }, { timeout: TEST_TIMEOUT });

    it('should check user permissions', async () => {
      await client.query(
        `INSERT INTO users (email, role) VALUES ($1, $2)`,
        ['user@example.com', 'user']
      );

      await client.query(
        `INSERT INTO permissions (role, resource, action) VALUES ($1, $2, $3)`,
        ['user', 'teams', 'read']
      );

      const result = await client.query(
        `SELECT p.* FROM permissions p
         JOIN users u ON u.role = p.role
         WHERE u.email = $1 AND p.resource = $2 AND p.action = $3`,
        ['user@example.com', 'teams', 'read']
      );

      expect(result.rows.length).toBe(1);
    }, { timeout: TEST_TIMEOUT });

    it('should deny unauthorized access', async () => {
      await client.query(
        `INSERT INTO users (email, role) VALUES ($1, $2)`,
        ['viewer@example.com', 'viewer']
      );

      await client.query(
        `INSERT INTO permissions (role, resource, action) VALUES ($1, $2, $3)`,
        ['viewer', 'teams', 'read']
      );

      const result = await client.query(
        `SELECT p.* FROM permissions p
         JOIN users u ON u.role = p.role
         WHERE u.email = $1 AND p.resource = $2 AND p.action = $3`,
        ['viewer@example.com', 'teams', 'delete']
      );

      expect(result.rows.length).toBe(0);
    }, { timeout: TEST_TIMEOUT });
  });
});
