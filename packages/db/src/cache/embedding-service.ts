import { createHash } from "crypto";

/**
 * Embedding Service Configuration
 */
export interface EmbeddingServiceConfig {
  /**
   * Embedding service URL (e.g., OpenAI API)
   */
  serviceUrl: string;

  /**
   * API key for authentication
   */
  apiKey: string;

  /**
   * Embedding model to use
   * Default: "text-embedding-ada-002"
   */
  model?: string;

  /**
   * Request timeout in milliseconds
   * Default: 10000
   */
  timeout?: number;

  /**
   * Maximum batch size for batch embeddings
   * Default: 100
   */
  maxBatchSize?: number;

  /**
   * Enable caching of embeddings
   * Default: true
   */
  enableCache?: boolean;
}

/**
 * Embedding result
 */
export interface EmbeddingResult {
  embedding: number[];
  model: string;
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}

/**
 * Batch embedding result
 */
export interface BatchEmbeddingResult {
  embeddings: number[][];
  model: string;
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}

/**
 * Embedding Service
 *
 * Handles embedding generation using external providers (OpenAI, etc.)
 * Supports:
 * - Single and batch embedding generation
 * - In-memory caching of embeddings
 * - Error handling and retries
 */
export class EmbeddingService {
  private readonly serviceUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeout: number;
  private readonly maxBatchSize: number;
  private readonly enableCache: boolean;
  private readonly cache: Map<string, number[]>;

  public constructor(config: EmbeddingServiceConfig) {
    this.serviceUrl = config.serviceUrl;
    this.apiKey = config.apiKey;
    this.model = config.model ?? "text-embedding-ada-002";
    this.timeout = config.timeout ?? 10000;
    this.maxBatchSize = config.maxBatchSize ?? 100;
    this.enableCache = config.enableCache ?? true;
    this.cache = new Map();
  }

  /**
   * Generate embedding for a single text
   */
  public async embed(text: string): Promise<EmbeddingResult> {
    // Check cache first
    if (this.enableCache) {
      const cacheKey = this.getCacheKey(text);
      const cached = this.cache.get(cacheKey);

      if (cached) {
        return {
          embedding: cached,
          model: this.model,
          usage: {
            promptTokens: 0,
            totalTokens: 0
          }
        };
      }
    }

    // Generate embedding
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.serviceUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          input: text,
          model: this.model
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Embedding request failed: ${response.status} ${errorText}`
        );
      }

      const data = (await response.json()) as {
        data: Array<{ embedding: number[] }>;
        model: string;
        usage: {
          prompt_tokens: number;
          total_tokens: number;
        };
      };

      const embedding = data.data[0]?.embedding;
      if (!embedding) {
        throw new Error("No embedding returned from service");
      }

      // Cache the result
      if (this.enableCache) {
        const cacheKey = this.getCacheKey(text);
        this.cache.set(cacheKey, embedding);
      }

      return {
        embedding,
        model: data.model,
        usage: {
          promptTokens: data.usage.prompt_tokens,
          totalTokens: data.usage.total_tokens
        }
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Generate embeddings for multiple texts in a batch
   */
  public async embedBatch(texts: string[]): Promise<BatchEmbeddingResult> {
    if (texts.length === 0) {
      throw new Error("Cannot embed empty batch");
    }

    if (texts.length > this.maxBatchSize) {
      throw new Error(
        `Batch size ${texts.length} exceeds maximum ${this.maxBatchSize}`
      );
    }

    // Check cache for all texts
    const cachedEmbeddings: (number[] | null)[] = [];
    const uncachedIndices: number[] = [];
    const uncachedTexts: string[] = [];

    if (this.enableCache) {
      for (let i = 0; i < texts.length; i++) {
        const text = texts[i]!;
        const cacheKey = this.getCacheKey(text);
        const cached = this.cache.get(cacheKey);

        if (cached) {
          cachedEmbeddings.push(cached);
        } else {
          cachedEmbeddings.push(null);
          uncachedIndices.push(i);
          uncachedTexts.push(text);
        }
      }
    } else {
      uncachedIndices.push(...texts.map((_, i) => i));
      uncachedTexts.push(...texts);
    }

    // If all cached, return immediately
    if (uncachedTexts.length === 0) {
      return {
        embeddings: cachedEmbeddings as number[][],
        model: this.model,
        usage: {
          promptTokens: 0,
          totalTokens: 0
        }
      };
    }

    // Generate embeddings for uncached texts
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.serviceUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          input: uncachedTexts,
          model: this.model
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Embedding request failed: ${response.status} ${errorText}`
        );
      }

      const data = (await response.json()) as {
        data: Array<{ embedding: number[] }>;
        model: string;
        usage: {
          prompt_tokens: number;
          total_tokens: number;
        };
      };

      // Merge cached and new embeddings
      const finalEmbeddings: number[][] = [];

      for (let i = 0; i < texts.length; i++) {
        if (cachedEmbeddings[i]) {
          finalEmbeddings.push(cachedEmbeddings[i]!);
        } else {
          const uncachedIndex = uncachedIndices.indexOf(i);
          const embedding = data.data[uncachedIndex]?.embedding;

          if (!embedding) {
            throw new Error(`No embedding returned for text at index ${i}`);
          }

          finalEmbeddings.push(embedding);

          // Cache the result
          if (this.enableCache) {
            const text = texts[i]!;
            const cacheKey = this.getCacheKey(text);
            this.cache.set(cacheKey, embedding);
          }
        }
      }

      return {
        embeddings: finalEmbeddings,
        model: data.model,
        usage: {
          promptTokens: data.usage.prompt_tokens,
          totalTokens: data.usage.total_tokens
        }
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Clear the embedding cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    size: number;
    maxSize: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxBatchSize * 10 // Arbitrary limit
    };
  }

  /**
   * Generate cache key for a text
   */
  private getCacheKey(text: string): string {
    return createHash("sha256")
      .update(`${this.model}:${text}`)
      .digest("hex");
  }
}
