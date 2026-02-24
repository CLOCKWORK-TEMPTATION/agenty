import type {
  LiteLLMRequestOptions,
  LiteLLMResponse
} from "@repo/types";
import type { SemanticCache } from "@repo/db/cache";
import type { CacheMetricsCollector } from "@repo/db/cache";

/**
 * Semantic Cache Interceptor Configuration
 */
export interface SemanticCacheInterceptorConfig {
  /**
   * Semantic cache instance
   */
  cache: SemanticCache;

  /**
   * Metrics collector for tracking cache performance
   */
  metricsCollector?: CacheMetricsCollector;

  /**
   * Enable cache logging for debugging
   * Default: false
   */
  enableLogging?: boolean;
}

/**
 * Cache intercept result
 */
export interface CacheInterceptResult {
  /**
   * Whether cache was hit
   */
  hit: boolean;

  /**
   * Cached response (if hit)
   */
  response?: LiteLLMResponse;

  /**
   * Similarity score (if hit)
   */
  similarity?: number;

  /**
   * Cache source (redis or pgvector)
   */
  source?: "redis" | "pgvector";

  /**
   * Lookup time in milliseconds
   */
  lookupTimeMs: number;
}

/**
 * Semantic Cache Interceptor
 *
 * Intercepts LiteLLM requests to check cache before making API calls.
 * Caches responses after successful API calls.
 */
export class SemanticCacheInterceptor {
  private readonly cache: SemanticCache;
  private readonly metricsCollector: CacheMetricsCollector | undefined;
  private readonly enableLogging: boolean;

  public constructor(config: SemanticCacheInterceptorConfig) {
    this.cache = config.cache;
    this.metricsCollector = config.metricsCollector;
    this.enableLogging = config.enableLogging ?? false;
  }

  /**
   * Check cache before making LLM request
   */
  public async checkCache(
    options: LiteLLMRequestOptions
  ): Promise<CacheInterceptResult> {
    const startTime = Date.now();

    try {
      // Convert messages to prompt text
      const promptText = this.convertMessagesToPrompt(options.messages);

      // Lookup in cache
      const result = await this.cache.lookup(promptText, options.model);

      const lookupTimeMs = Date.now() - startTime;

      if (result.hit && result.entry) {
        // Cache hit - convert entry to LiteLLM response
        const response = this.convertCacheEntryToResponse(
          result.entry.responseText,
          result.entry.responseMetadata,
          options.model
        );

        // Record metrics
        if (this.metricsCollector) {
          this.metricsCollector.recordHit(lookupTimeMs);
        }

        if (this.enableLogging) {
          console.log(
            `[SemanticCache] HIT (${result.source}) - Model: ${options.model}, Similarity: ${result.similarity?.toFixed(4)}, Time: ${lookupTimeMs}ms`
          );
        }

        const interceptResult: CacheInterceptResult = {
          hit: true,
          response,
          lookupTimeMs
        };

        if (result.similarity !== undefined) {
          interceptResult.similarity = result.similarity;
        }

        if (result.source !== undefined) {
          interceptResult.source = result.source;
        }

        return interceptResult;
      }

      // Cache miss
      if (this.metricsCollector) {
        this.metricsCollector.recordMiss(lookupTimeMs);
      }

      if (this.enableLogging) {
        console.log(
          `[SemanticCache] MISS - Model: ${options.model}, Time: ${lookupTimeMs}ms`
        );
      }

      return {
        hit: false,
        lookupTimeMs
      };
    } catch (error) {
      const lookupTimeMs = Date.now() - startTime;

      if (this.metricsCollector) {
        this.metricsCollector.recordError();
      }

      if (this.enableLogging) {
        console.error(
          `[SemanticCache] ERROR - ${error instanceof Error ? error.message : String(error)}`
        );
      }

      // On error, return cache miss to fallback to LLM
      return {
        hit: false,
        lookupTimeMs
      };
    }
  }

  /**
   * Store response in cache after successful LLM call
   */
  public async storeResponse(
    options: LiteLLMRequestOptions,
    response: LiteLLMResponse
  ): Promise<void> {
    try {
      // Convert messages to prompt text
      const promptText = this.convertMessagesToPrompt(options.messages);

      // Extract response text
      const responseText =
        response.choices[0]?.message?.content ?? "";

      // Store in cache
      await this.cache.set({
        promptText,
        responseText,
        responseMetadata: {
          model: response.model,
          finishReason: response.choices[0]?.finish_reason,
          usage: response.usage,
          id: response.id,
          created: response.created
        },
        model: options.model
      });

      if (this.enableLogging) {
        console.log(
          `[SemanticCache] STORED - Model: ${options.model}, Response length: ${responseText.length}`
        );
      }
    } catch (error) {
      if (this.metricsCollector) {
        this.metricsCollector.recordError();
      }

      if (this.enableLogging) {
        console.error(
          `[SemanticCache] STORE ERROR - ${error instanceof Error ? error.message : String(error)}`
        );
      }

      // Don't throw - caching failure shouldn't break the response
    }
  }

  /**
   * Convert messages array to prompt text for caching
   */
  private convertMessagesToPrompt(
    messages: Array<{ role: string; content: string }>
  ): string {
    return messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join("\n");
  }

  /**
   * Convert cache entry to LiteLLM response format
   */
  private convertCacheEntryToResponse(
    responseText: string,
    responseMetadata: Record<string, unknown>,
    model: string
  ): LiteLLMResponse {
    const finishReason = responseMetadata.finishReason as string | undefined;
    const validFinishReason: "stop" | "length" | "tool_calls" | "content_filter" | null =
      finishReason === "stop" ||
      finishReason === "length" ||
      finishReason === "tool_calls" ||
      finishReason === "content_filter"
        ? finishReason
        : "stop";

    return {
      id: (responseMetadata.id as string) ?? `cached-${Date.now()}`,
      object: "chat.completion",
      created: (responseMetadata.created as number) ?? Math.floor(Date.now() / 1000),
      model: (responseMetadata.model as string) ?? model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: responseText
          },
          finish_reason: validFinishReason
        }
      ],
      usage: (responseMetadata.usage as {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      }) ?? {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    };
  }
}
