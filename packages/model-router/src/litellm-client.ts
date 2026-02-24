import type {
  LiteLLMRequestOptions,
  LiteLLMResponse,
  LiteLLMStreamChunk,
  LiteLLMClientConfig,
  LiteLLMRoutingPool,
  AppError
} from "@repo/types";
import { AppError as ErrorClass } from "@repo/types";
import type { SemanticCacheInterceptor } from "./semantic-cache-interceptor.js";

/**
 * LiteLLM Client Wrapper
 *
 * Provides a unified interface for making requests to LiteLLM proxy server.
 * Supports:
 * - Multiple model providers (Anthropic, OpenAI, Google, Azure, Bedrock)
 * - Routing pools with fallback chains
 * - Automatic retries with exponential backoff
 * - Streaming responses
 * - Quality-first model selection
 * - Semantic caching for similar prompts
 */
export class LiteLLMClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly defaultRoutingPool: LiteLLMRoutingPool | undefined;
  private readonly cacheInterceptor: SemanticCacheInterceptor | undefined;

  public constructor(
    config: LiteLLMClientConfig,
    cacheInterceptor?: SemanticCacheInterceptor
  ) {
    this.baseUrl = config.baseUrl ?? "http://localhost:4000";
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 30000;
    this.maxRetries = config.maxRetries ?? 3;
    this.defaultRoutingPool = config.defaultRoutingPool;
    this.cacheInterceptor = cacheInterceptor;
  }

  /**
   * Make a chat completion request to LiteLLM
   *
   * @param options - Request options including model, messages, and parameters
   * @param routingPool - Optional routing pool for fallback handling
   * @returns Chat completion response
   * @throws AppError with retryable flag on failure
   */
  public async chatCompletion(
    options: LiteLLMRequestOptions,
    routingPool?: LiteLLMRoutingPool
  ): Promise<LiteLLMResponse> {
    // Check semantic cache first
    if (this.cacheInterceptor) {
      const cacheResult = await this.cacheInterceptor.checkCache(options);

      if (cacheResult.hit && cacheResult.response) {
        return cacheResult.response;
      }
    }

    const pool = routingPool ?? this.defaultRoutingPool;
    const models = pool ? pool.models : [options.model];
    const maxAttempts = pool ? pool.maxRetries : this.maxRetries;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const modelToTry = this.selectModelFromPool(models, attempt, pool?.routingStrategy ?? "quality-first");

      try {
        const response = await this.makeRequest({
          ...options,
          model: modelToTry
        });

        // Store response in cache
        if (this.cacheInterceptor) {
          await this.cacheInterceptor.storeResponse(options, response);
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        const isRetryable = this.isRetryableError(error);

        if (!isRetryable || attempt === maxAttempts - 1) {
          throw this.createAppError(lastError, attempt + 1, isRetryable);
        }

        // Exponential backoff before retry
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }

    // This should never be reached due to the throw above, but TypeScript needs it
    throw this.createAppError(
      lastError ?? new Error("Unknown error"),
      maxAttempts,
      false
    );
  }

  /**
   * Make a streaming chat completion request to LiteLLM
   *
   * @param options - Request options including model, messages, and parameters
   * @param routingPool - Optional routing pool for fallback handling
   * @returns Async iterator of stream chunks
   * @throws AppError with retryable flag on failure
   */
  public async *chatCompletionStream(
    options: LiteLLMRequestOptions,
    routingPool?: LiteLLMRoutingPool
  ): AsyncGenerator<LiteLLMStreamChunk> {
    const pool = routingPool ?? this.defaultRoutingPool;
    const models = pool ? pool.models : [options.model];
    const maxAttempts = pool ? pool.maxRetries : this.maxRetries;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const modelToTry = this.selectModelFromPool(models, attempt, pool?.routingStrategy ?? "quality-first");

      try {
        const response = await this.makeStreamRequest({
          ...options,
          model: modelToTry,
          stream: true
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`LiteLLM request failed: ${response.status} ${errorText}`);
        }

        if (!response.body) {
          throw new Error("Response body is null");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter(line => line.trim() !== "");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);

                if (data === "[DONE]") {
                  return;
                }

                try {
                  const parsed = JSON.parse(data) as LiteLLMStreamChunk;
                  yield parsed;
                } catch {
                  // Skip malformed JSON chunks
                  continue;
                }
              }
            }
          }

          // Stream completed successfully, return
          return;
        } finally {
          reader.releaseLock();
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const isRetryable = this.isRetryableError(error);

        if (!isRetryable || attempt === maxAttempts - 1) {
          throw this.createAppError(lastError, attempt + 1, isRetryable);
        }

        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }

    throw this.createAppError(
      lastError ?? new Error("Unknown error"),
      maxAttempts,
      false
    );
  }

  /**
   * Select a model from the routing pool based on strategy
   *
   * @param models - Available models in the pool
   * @param attempt - Current attempt number (used for round-robin and fallback)
   * @param strategy - Routing strategy
   * @returns Selected model ID
   */
  private selectModelFromPool(
    models: string[],
    attempt: number,
    strategy: "round-robin" | "quality-first" | "latency-based"
  ): string {
    if (models.length === 0) {
      throw new Error("No models available in routing pool");
    }

    switch (strategy) {
      case "round-robin":
        return models[attempt % models.length] ?? models[0]!;

      case "quality-first":
        // First model is highest quality, fallback to next on failure
        return models[Math.min(attempt, models.length - 1)] ?? models[0]!;

      case "latency-based":
        // For now, use same as quality-first
        // In production, this would use real-time latency metrics
        return models[Math.min(attempt, models.length - 1)] ?? models[0]!;

      default:
        return models[0]!;
    }
  }

  /**
   * Make HTTP request to LiteLLM API
   */
  private async makeRequest(options: LiteLLMRequestOptions): Promise<LiteLLMResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` })
        },
        body: JSON.stringify(options),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LiteLLM request failed: ${response.status} ${errorText}`);
      }

      const data = await response.json() as LiteLLMResponse;
      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Make streaming HTTP request to LiteLLM API
   */
  private async makeStreamRequest(options: LiteLLMRequestOptions): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` })
        },
        body: JSON.stringify(options),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Network errors are retryable
      if (message.includes("network") || message.includes("fetch")) {
        return true;
      }

      // Timeout errors are retryable
      if (message.includes("timeout") || message.includes("aborted")) {
        return true;
      }

      // Rate limit errors are retryable
      if (message.includes("429") || message.includes("rate limit")) {
        return true;
      }

      // Server errors (5xx) are retryable
      if (message.match(/50[0-9]/)) {
        return true;
      }

      // Service unavailable
      if (message.includes("503") || message.includes("unavailable")) {
        return true;
      }
    }

    return false;
  }

  /**
   * Create an AppError from a caught error
   */
  private createAppError(error: Error, attempts: number, retryable: boolean): AppError {
    return new ErrorClass({
      message: `LiteLLM request failed after ${attempts} attempt(s): ${error.message}`,
      errorCode: "LITELLM_REQUEST_FAILED",
      retryable,
      traceId: this.generateTraceId(),
      statusCode: 500,
      details: {
        originalError: error.message,
        attempts
      }
    });
  }

  /**
   * Generate a unique trace ID for error tracking
   */
  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Delay helper for exponential backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
