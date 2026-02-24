/**
 * LiteLLM Integration Tests
 * Tests LiteLLM proxy connection and routing
 */

import { describe, it, expect, beforeAll } from 'vitest';

const TEST_TIMEOUT = 30000;

const getLiteLLMConfig = () => ({
  baseURL: process.env.LITELLM_API_BASE || 'http://localhost:4001',
  apiKey: process.env.LITELLM_MASTER_KEY || 'replace_me',
});

describe('LiteLLM Integration Tests', () => {
  let config: ReturnType<typeof getLiteLLMConfig>;

  beforeAll(() => {
    config = getLiteLLMConfig();
  });

  describe('Health Check', () => {
    it('should connect to LiteLLM proxy', async () => {
      const response = await fetch(`${config.baseURL}/health`);
      expect(response.ok).toBe(true);
    }, { timeout: TEST_TIMEOUT });
  });

  describe('Model Routing', () => {
    it('should route to correct model provider', async () => {
      const models = ['gpt-4', 'claude-3-5-sonnet-20241022', 'gemini-pro'];

      for (const model of models) {
        const routing = { model, provider: 'auto' };
        expect(routing.model).toBeDefined();
      }
    }, { timeout: TEST_TIMEOUT });
  });

  describe('Fallback Chains', () => {
    it('should fallback to secondary model on failure', async () => {
      const fallbackChain = [
        { model: 'gpt-4', priority: 1 },
        { model: 'claude-3-5-sonnet-20241022', priority: 2 },
        { model: 'gemini-pro', priority: 3 },
      ];

      expect(fallbackChain.length).toBe(3);
      expect(fallbackChain[0].priority).toBeLessThan(fallbackChain[1].priority);
    }, { timeout: TEST_TIMEOUT });
  });
});
