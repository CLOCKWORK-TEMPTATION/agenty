import { describe, it, expect, vi, beforeEach } from "vitest";
import { SemanticCacheInterceptor } from "../src/semantic-cache-interceptor.js";
import type { SemanticCache, CacheMetricsCollector } from "@repo/db/cache";
import type { LiteLLMRequestOptions, LiteLLMResponse } from "@repo/types";

// Mock the cache
const createMockCache = (): SemanticCache => ({
  lookup: vi.fn(),
  set: vi.fn(),
  invalidateByModel: vi.fn(),
  invalidateByPromptHash: vi.fn(),
  invalidateAll: vi.fn(),
  cleanupExpired: vi.fn(),
  getStats: vi.fn(),
  getTopPrompts: vi.fn()
} as unknown as SemanticCache);

// Mock the metrics collector
const createMockMetrics = (): CacheMetricsCollector => ({
  recordHit: vi.fn(),
  recordMiss: vi.fn(),
  recordError: vi.fn(),
  getMetrics: vi.fn(),
  getTimeSeries: vi.fn(),
  reset: vi.fn()
} as unknown as CacheMetricsCollector);

describe("SemanticCacheInterceptor", () => {
  let mockCache: SemanticCache;
  let mockMetrics: CacheMetricsCollector;
  let interceptor: SemanticCacheInterceptor;

  const sampleRequest: LiteLLMRequestOptions = {
    model: "claude-3-opus",
    messages: [
      { role: "user", content: "What is machine learning?" }
    ]
  };

  const sampleResponse: LiteLLMResponse = {
    id: "test-123",
    object: "chat.completion",
    created: Date.now(),
    model: "claude-3-opus",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: "Machine learning is a subset of artificial intelligence..."
        },
        finish_reason: "stop"
      }
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 50,
      total_tokens: 60
    }
  };

  beforeEach(() => {
    mockCache = createMockCache();
    mockMetrics = createMockMetrics();
    interceptor = new SemanticCacheInterceptor({
      cache: mockCache,
      metricsCollector: mockMetrics,
      enableLogging: false
    });
  });

  describe("checkCache", () => {
    it("should return cache hit when entry found", async () => {
      vi.mocked(mockCache.lookup).mockResolvedValue({
        hit: true,
        entry: {
          id: "entry-1",
          promptHash: "hash123",
          promptText: "What is machine learning?",
          promptEmbedding: [],
          responseText: "Machine learning is a subset of artificial intelligence...",
          responseMetadata: {
            finishReason: "stop",
            usage: { prompt_tokens: 10, completion_tokens: 50, total_tokens: 60 }
          },
          model: "claude-3-opus",
          createdAt: new Date(),
          accessedAt: new Date(),
          accessCount: 5,
          ttlSeconds: 3600,
          expiresAt: new Date(Date.now() + 3600000)
        },
        similarity: 0.95,
        source: "pgvector"
      });

      const result = await interceptor.checkCache(sampleRequest);

      expect(result.hit).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.similarity).toBe(0.95);
      expect(result.source).toBe("pgvector");
      expect(mockMetrics.recordHit).toHaveBeenCalled();
    });

    it("should return cache miss when no entry found", async () => {
      vi.mocked(mockCache.lookup).mockResolvedValue({ hit: false });

      const result = await interceptor.checkCache(sampleRequest);

      expect(result.hit).toBe(false);
      expect(result.response).toBeUndefined();
      expect(mockMetrics.recordMiss).toHaveBeenCalled();
    });

    it("should handle cache lookup errors gracefully", async () => {
      vi.mocked(mockCache.lookup).mockRejectedValue(new Error("DB connection failed"));

      const result = await interceptor.checkCache(sampleRequest);

      expect(result.hit).toBe(false);
      expect(result.response).toBeUndefined();
      expect(mockMetrics.recordError).toHaveBeenCalled();
    });

    it("should convert messages to prompt text correctly", async () => {
      vi.mocked(mockCache.lookup).mockResolvedValue({ hit: false });

      const requestWithMultipleMessages: LiteLLMRequestOptions = {
        model: "claude-3-opus",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi there!" },
          { role: "user", content: "How are you?" }
        ]
      };

      await interceptor.checkCache(requestWithMultipleMessages);

      expect(mockCache.lookup).toHaveBeenCalledWith(
        "system: You are a helpful assistant.\nuser: Hello\nassistant: Hi there!\nuser: How are you?",
        "claude-3-opus"
      );
    });

    it("should return cached response in correct format", async () => {
      vi.mocked(mockCache.lookup).mockResolvedValue({
        hit: true,
        entry: {
          id: "entry-1",
          promptHash: "hash123",
          promptText: "Test prompt",
          promptEmbedding: [],
          responseText: "Test response",
          responseMetadata: {
            model: "claude-3-opus",
            finishReason: "stop",
            usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
            id: "resp-123",
            created: 1234567890
          },
          model: "claude-3-opus",
          createdAt: new Date(),
          accessedAt: new Date(),
          accessCount: 1,
          ttlSeconds: 3600,
          expiresAt: new Date(Date.now() + 3600000)
        },
        similarity: 0.98,
        source: "redis"
      });

      const result = await interceptor.checkCache(sampleRequest);

      expect(result.hit).toBe(true);
      expect(result.response).toMatchObject({
        object: "chat.completion",
        model: "claude-3-opus",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "Test response"
            },
            finish_reason: "stop"
          }
        ]
      });
    });
  });

  describe("storeResponse", () => {
    it("should store response in cache", async () => {
      await interceptor.storeResponse(sampleRequest, sampleResponse);

      expect(mockCache.set).toHaveBeenCalledWith({
        promptText: "user: What is machine learning?",
        responseText: "Machine learning is a subset of artificial intelligence...",
        responseMetadata: {
          model: "claude-3-opus",
          finishReason: "stop",
          usage: {
            prompt_tokens: 10,
            completion_tokens: 50,
            total_tokens: 60
          },
          id: "test-123",
          created: expect.any(Number)
        },
        model: "claude-3-opus"
      });
    });

    it("should handle store errors gracefully", async () => {
      vi.mocked(mockCache.set).mockRejectedValue(new Error("Storage failed"));

      // Should not throw
      await expect(interceptor.storeResponse(sampleRequest, sampleResponse)).resolves.not.toThrow();
      expect(mockMetrics.recordError).toHaveBeenCalled();
    });

    it("should handle empty response content", async () => {
      const emptyResponse: LiteLLMResponse = {
        ...sampleResponse,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: ""
            },
            finish_reason: "stop"
          }
        ]
      };

      await interceptor.storeResponse(sampleRequest, emptyResponse);

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.objectContaining({
          responseText: ""
        })
      );
    });
  });

  describe("integration with LiteLLM flow", () => {
    it("should handle complete cache miss flow", async () => {
      // First call - cache miss
      vi.mocked(mockCache.lookup).mockResolvedValue({ hit: false });
      const missResult = await interceptor.checkCache(sampleRequest);
      expect(missResult.hit).toBe(false);

      // Store the response
      await interceptor.storeResponse(sampleRequest, sampleResponse);
      expect(mockCache.set).toHaveBeenCalled();
    });

    it("should handle cache hit flow", async () => {
      // Cache hit
      vi.mocked(mockCache.lookup).mockResolvedValue({
        hit: true,
        entry: {
          id: "entry-1",
          promptHash: "hash123",
          promptText: "What is machine learning?",
          promptEmbedding: [],
          responseText: "Cached answer",
          responseMetadata: { finishReason: "stop" },
          model: "claude-3-opus",
          createdAt: new Date(),
          accessedAt: new Date(),
          accessCount: 1,
          ttlSeconds: 3600,
          expiresAt: new Date(Date.now() + 3600000)
        },
        similarity: 0.96,
        source: "pgvector"
      });

      const result = await interceptor.checkCache(sampleRequest);

      expect(result.hit).toBe(true);
      expect(result.response?.choices[0]?.message.content).toBe("Cached answer");
    });
  });

  describe("finish_reason handling", () => {
    it("should handle all valid finish reasons", async () => {
      const validReasons = ["stop", "length", "tool_calls", "content_filter", null] as const;

      for (const reason of validReasons) {
        const response: LiteLLMResponse = {
          ...sampleResponse,
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "Test" },
              finish_reason: reason
            }
          ]
        };

        await interceptor.storeResponse(sampleRequest, response);
        expect(mockCache.set).toHaveBeenCalled();

        // Reset mock for next iteration
        vi.mocked(mockCache.set).mockClear();
      }
    });
  });
});
