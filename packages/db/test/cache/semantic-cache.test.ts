import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Pool } from "pg";
import { SemanticCache } from "../../src/cache/semantic-cache.js";
import { EmbeddingService } from "../../src/cache/embedding-service.js";
import { createCachePolicy } from "../../src/cache/cache-policy.js";

describe("SemanticCache", () => {
  let mockPool: Pool;
  let mockEmbeddingService: EmbeddingService;
  let semanticCache: SemanticCache;

  beforeEach(() => {
    // Mock pool
    mockPool = {
      query: vi.fn()
    } as unknown as Pool;

    // Mock embedding service
    mockEmbeddingService = {
      embed: vi.fn().mockResolvedValue({
        embedding: new Array(1536).fill(0.1),
        model: "text-embedding-ada-002",
        usage: {
          promptTokens: 10,
          totalTokens: 10
        }
      })
    } as unknown as EmbeddingService;

    const policy = createCachePolicy({
      similarityThreshold: 0.95,
      ttlSeconds: 3600
    });

    semanticCache = new SemanticCache(
      mockPool,
      mockEmbeddingService,
      policy
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("lookup", () => {
    it("should return cache miss when no similar entry exists", async () => {
      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [],
        command: "SELECT",
        rowCount: 0,
        oid: 0,
        fields: []
      });

      const result = await semanticCache.lookup(
        "What is the capital of France?",
        "gpt-4"
      );

      expect(result.hit).toBe(false);
      expect(result.entry).toBeUndefined();
    });

    it("should return cache hit when similar entry exists", async () => {
      const mockEntry = {
        id: "test-id",
        prompt_hash: "test-hash",
        prompt_text: "What is the capital of France?",
        response_text: "Paris",
        response_metadata: { finishReason: "stop" },
        model: "gpt-4",
        created_at: new Date(),
        accessed_at: new Date(),
        access_count: 1,
        ttl_seconds: 3600,
        expires_at: new Date(Date.now() + 3600000),
        similarity: 0.98
      };

      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [mockEntry],
        command: "SELECT",
        rowCount: 1,
        oid: 0,
        fields: []
      });

      const result = await semanticCache.lookup(
        "What is the capital of France?",
        "gpt-4"
      );

      expect(result.hit).toBe(true);
      expect(result.entry).toBeDefined();
      expect(result.entry?.responseText).toBe("Paris");
      expect(result.similarity).toBe(0.98);
      expect(result.source).toBe("pgvector");
    });

    it("should not cache prompts that are too short", async () => {
      const policy = createCachePolicy({
        minPromptLength: 20
      });

      const shortCache = new SemanticCache(
        mockPool,
        mockEmbeddingService,
        policy
      );

      const result = await shortCache.lookup("Hi", "gpt-4");

      expect(result.hit).toBe(false);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it("should not cache prompts for excluded models", async () => {
      const policy = createCachePolicy({
        excludedModels: ["gpt-4"]
      });

      const excludedCache = new SemanticCache(
        mockPool,
        mockEmbeddingService,
        policy
      );

      const result = await excludedCache.lookup(
        "What is the capital of France?",
        "gpt-4"
      );

      expect(result.hit).toBe(false);
      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });

  describe("set", () => {
    it("should store cache entry", async () => {
      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [],
        command: "INSERT",
        rowCount: 1,
        oid: 0,
        fields: []
      });

      await semanticCache.set({
        promptText: "What is the capital of France?",
        responseText: "Paris",
        responseMetadata: { finishReason: "stop" },
        model: "gpt-4"
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO semantic_cache"),
        expect.arrayContaining([
          expect.any(String), // prompt_hash
          "What is the capital of France?",
          expect.any(String), // embedding
          "Paris",
          expect.any(String), // response_metadata
          "gpt-4",
          expect.any(Number), // ttl_seconds
          expect.any(Date) // expires_at
        ])
      );
    });

    it("should not store prompts that are too short", async () => {
      const policy = createCachePolicy({
        minPromptLength: 20
      });

      const shortCache = new SemanticCache(
        mockPool,
        mockEmbeddingService,
        policy
      );

      await shortCache.set({
        promptText: "Hi",
        responseText: "Hello",
        model: "gpt-4"
      });

      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });

  describe("invalidateByModel", () => {
    it("should delete cache entries for a specific model", async () => {
      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [{ count: 5 }],
        command: "DELETE",
        rowCount: 5,
        oid: 0,
        fields: []
      });

      const count = await semanticCache.invalidateByModel("gpt-4");

      expect(count).toBe(5);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM semantic_cache"),
        ["gpt-4"]
      );
    });
  });

  describe("invalidateAll", () => {
    it("should delete all cache entries", async () => {
      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [{ count: 10 }],
        command: "DELETE",
        rowCount: 10,
        oid: 0,
        fields: []
      });

      const count = await semanticCache.invalidateAll();

      expect(count).toBe(10);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM semantic_cache")
      );
    });
  });

  describe("cleanupExpired", () => {
    it("should delete expired cache entries", async () => {
      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [{ count: 3 }],
        command: "DELETE",
        rowCount: 3,
        oid: 0,
        fields: []
      });

      const count = await semanticCache.cleanupExpired();

      expect(count).toBe(3);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE expires_at <= NOW()")
      );
    });
  });

  describe("getStats", () => {
    it("should return cache statistics", async () => {
      vi.mocked(mockPool.query)
        .mockResolvedValueOnce({
          rows: [
            {
              total_entries: 100,
              expired_entries: 10,
              avg_access_count: 5.5
            }
          ],
          command: "SELECT",
          rowCount: 1,
          oid: 0,
          fields: []
        })
        .mockResolvedValueOnce({
          rows: [
            { model: "gpt-4", count: 60 },
            { model: "claude-3", count: 40 }
          ],
          command: "SELECT",
          rowCount: 2,
          oid: 0,
          fields: []
        });

      const stats = await semanticCache.getStats();

      expect(stats.totalEntries).toBe(100);
      expect(stats.expiredEntries).toBe(10);
      expect(stats.avgAccessCount).toBe(5.5);
      expect(stats.modelBreakdown).toHaveLength(2);
      expect(stats.modelBreakdown[0]).toEqual({
        model: "gpt-4",
        count: 60
      });
    });
  });

  describe("getTopPrompts", () => {
    it("should return top cached prompts", async () => {
      const mockPrompts = [
        {
          prompt_text: "What is AI?",
          model: "gpt-4",
          access_count: 10,
          created_at: new Date()
        },
        {
          prompt_text: "Explain quantum computing",
          model: "claude-3",
          access_count: 8,
          created_at: new Date()
        }
      ];

      vi.mocked(mockPool.query).mockResolvedValue({
        rows: mockPrompts,
        command: "SELECT",
        rowCount: 2,
        oid: 0,
        fields: []
      });

      const prompts = await semanticCache.getTopPrompts(10);

      expect(prompts).toHaveLength(2);
      expect(prompts[0]?.promptText).toBe("What is AI?");
      expect(prompts[0]?.accessCount).toBe(10);
    });
  });
});
