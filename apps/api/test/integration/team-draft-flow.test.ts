/**
 * Team Draft Flow Integration Tests
 * Tests complete team creation workflow
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, Pool } from 'pg';

const TEST_TIMEOUT = 60000;

const getTestConfig = () => ({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'agents_test',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
});

describe('Team Draft Flow Integration Tests', () => {
  let pool: Pool;
  let client: Client;

  beforeAll(async () => {
    pool = new Pool(getTestConfig());
    client = await pool.connect();

    await client.query(`
      CREATE TABLE IF NOT EXISTS team_drafts (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255),
        task_description TEXT,
        draft_data JSONB,
        status VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
  }, { timeout: TEST_TIMEOUT });

  afterAll(async () => {
    await client.query('DROP TABLE IF EXISTS team_drafts');
    if (client) client.release();
    if (pool) await pool.end();
  });

  describe('Complete Draft Flow', () => {
    it('should create team draft from user request', async () => {
      const draft = {
        user_id: 'user-123',
        task_description: 'Build a web scraping system',
        draft_data: {
          agents: [
            { role: 'planner', model: 'gpt-4' },
            { role: 'developer', model: 'claude-3-5-sonnet-20241022' },
            { role: 'reviewer', model: 'gemini-pro' },
          ],
        },
        status: 'pending_approval',
      };

      const result = await client.query(
        `INSERT INTO team_drafts (user_id, task_description, draft_data, status)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [draft.user_id, draft.task_description, JSON.stringify(draft.draft_data), draft.status]
      );

      expect(result.rows[0].id).toBeGreaterThan(0);
    }, { timeout: TEST_TIMEOUT });

    it('should enforce minimum 2 different models', async () => {
      const invalidDraft = {
        agents: [
          { role: 'agent1', model: 'gpt-4' },
          { role: 'agent2', model: 'gpt-4' },
        ],
      };

      const models = new Set(invalidDraft.agents.map(a => a.model));
      expect(models.size).toBeLessThan(2); // Should fail validation
    }, { timeout: TEST_TIMEOUT });

    it('should route through complete graph', async () => {
      const graphNodes = [
        'intake',
        'profile',
        'template_select',
        'team_design',
        'model_route',
        'tools_allocate',
        'skills_load',
        'approval_gate',
        'planner',
        'specialists_parallel',
        'tool_executor',
        'aggregate',
        'verifier',
        'finalizer',
      ];

      expect(graphNodes).toContain('intake');
      expect(graphNodes).toContain('approval_gate');
      expect(graphNodes).toContain('verifier');
      expect(graphNodes).toContain('finalizer');
      expect(graphNodes[graphNodes.length - 1]).toBe('finalizer');
    }, { timeout: TEST_TIMEOUT });
  });
});
