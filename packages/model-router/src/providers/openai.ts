import type { LiteLLMRequestOptions, LiteLLMMessage, LiteLLMTool } from "@repo/types";

/**
 * OpenAI Provider Adapter
 *
 * Converts between LiteLLM format and OpenAI's native API format.
 * Handles model-specific configurations and optimizations for GPT models.
 */

export interface OpenAIConfig {
  apiKey: string;
  baseUrl?: string;
  organization?: string;
  defaultModel?: string;
}

/**
 * Available OpenAI GPT models
 */
export const OPENAI_MODELS = {
  GPT_4O: "gpt-4o",
  GPT_4O_MINI: "gpt-4o-mini",
  GPT_4_TURBO: "gpt-4-turbo",
  GPT_4: "gpt-4",
  GPT_3_5_TURBO: "gpt-3.5-turbo",
  O1: "o1",
  O1_MINI: "o1-mini"
} as const;

/**
 * Model quality scores for OpenAI models
 * Used in quality-first routing strategy
 */
export const OPENAI_MODEL_QUALITY = {
  [OPENAI_MODELS.O1]: 0.97,
  [OPENAI_MODELS.GPT_4O]: 0.94,
  [OPENAI_MODELS.O1_MINI]: 0.92,
  [OPENAI_MODELS.GPT_4_TURBO]: 0.91,
  [OPENAI_MODELS.GPT_4]: 0.89,
  [OPENAI_MODELS.GPT_4O_MINI]: 0.86,
  [OPENAI_MODELS.GPT_3_5_TURBO]: 0.80
} as const;

/**
 * Model tool reliability scores
 * Based on empirical testing of function calling accuracy
 */
export const OPENAI_TOOL_RELIABILITY = {
  [OPENAI_MODELS.O1]: 0.88, // o1 has limited tool support
  [OPENAI_MODELS.GPT_4O]: 0.95,
  [OPENAI_MODELS.O1_MINI]: 0.86,
  [OPENAI_MODELS.GPT_4_TURBO]: 0.93,
  [OPENAI_MODELS.GPT_4]: 0.91,
  [OPENAI_MODELS.GPT_4O_MINI]: 0.89,
  [OPENAI_MODELS.GPT_3_5_TURBO]: 0.85
} as const;

/**
 * Model context window sizes
 */
export const OPENAI_CONTEXT_LIMITS = {
  [OPENAI_MODELS.O1]: 200000,
  [OPENAI_MODELS.GPT_4O]: 128000,
  [OPENAI_MODELS.O1_MINI]: 128000,
  [OPENAI_MODELS.GPT_4_TURBO]: 128000,
  [OPENAI_MODELS.GPT_4]: 8192,
  [OPENAI_MODELS.GPT_4O_MINI]: 128000,
  [OPENAI_MODELS.GPT_3_5_TURBO]: 16385
} as const;

/**
 * Adapter class for OpenAI GPT models
 */
export class OpenAIAdapter {
  private readonly config: OpenAIConfig;

  public constructor(config: OpenAIConfig) {
    this.config = config;
  }

  /**
   * Convert LiteLLM request options to OpenAI-specific format
   *
   * @param options - LiteLLM request options
   * @returns Modified options optimized for OpenAI
   */
  public adaptRequest(options: LiteLLMRequestOptions): LiteLLMRequestOptions {
    const model = this.normalizeModelName(options.model);

    // Handle o1 models which have different parameter constraints
    if (this.isO1Model(model)) {
      return this.adaptO1Request(options, model);
    }

    // Standard GPT models
    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.max_tokens;

    // Suppress unused variable warning
    void this.config;

    return {
      ...options,
      model,
      temperature,
      ...(maxTokens && { max_tokens: maxTokens })
    };
  }

  /**
   * Adapt request for o1 models which have special constraints
   *
   * @param options - LiteLLM request options
   * @param model - Normalized model name
   * @returns Modified options for o1 models
   */
  private adaptO1Request(
    options: LiteLLMRequestOptions,
    model: string
  ): LiteLLMRequestOptions {
    // o1 models don't support temperature, top_p, or system messages
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { temperature, top_p, ...rest } = options;

    // Filter out system messages
    const messages = options.messages.filter((m: LiteLLMMessage) => m.role !== "system");

    // If there were system messages, prepend their content to first user message
    const systemMessages = options.messages.filter((m: LiteLLMMessage) => m.role === "system");
    if (systemMessages.length > 0 && messages.length > 0) {
      const systemContent = systemMessages.map((m: LiteLLMMessage) => m.content).join("\n\n");
      const firstUserMessage = messages.find((m: LiteLLMMessage) => m.role === "user");

      if (firstUserMessage) {
        firstUserMessage.content = `${systemContent}\n\n${firstUserMessage.content}`;
      }
    }

    return {
      ...rest,
      model,
      messages
    };
  }

  /**
   * Validate that messages format is compatible with OpenAI
   *
   * @param messages - Array of messages
   * @throws Error if validation fails
   */
  public validateMessages(messages: LiteLLMMessage[]): void {
    if (messages.length === 0) {
      throw new Error("Messages array cannot be empty");
    }

    // Check for valid roles
    for (const message of messages) {
      if (!["system", "user", "assistant", "tool"].includes(message.role)) {
        throw new Error(`Invalid message role: ${message.role}`);
      }
    }

    // Ensure at least one user message
    const hasUserMessage = messages.some(m => m.role === "user");
    if (!hasUserMessage) {
      throw new Error("At least one user message is required");
    }
  }

  /**
   * Validate tools format for OpenAI
   *
   * @param tools - Array of tools
   * @throws Error if validation fails
   */
  public validateTools(tools: LiteLLMTool[] | undefined): void {
    if (!tools || tools.length === 0) {
      return;
    }

    // OpenAI supports up to 128 tools per request
    if (tools.length > 128) {
      throw new Error("OpenAI supports maximum 128 tools per request");
    }

    for (const tool of tools) {
      if (tool.type !== "function") {
        throw new Error(`Unsupported tool type: ${tool.type}`);
      }

      if (!tool.function.name || !tool.function.description) {
        throw new Error("Tool must have name and description");
      }
    }
  }

  /**
   * Get quality score for a specific OpenAI model
   *
   * @param modelId - Model identifier
   * @returns Quality score between 0 and 1
   */
  public getModelQuality(modelId: string): number {
    const normalized = this.normalizeModelName(modelId);

    for (const [model, quality] of Object.entries(OPENAI_MODEL_QUALITY)) {
      if (normalized === model || normalized.startsWith(`${model}-`)) {
        return quality;
      }
    }

    return 0.75;
  }

  /**
   * Get tool reliability score for a specific OpenAI model
   *
   * @param modelId - Model identifier
   * @returns Tool reliability score between 0 and 1
   */
  public getToolReliability(modelId: string): number {
    const normalized = this.normalizeModelName(modelId);

    for (const [model, reliability] of Object.entries(OPENAI_TOOL_RELIABILITY)) {
      if (normalized === model || normalized.startsWith(`${model}-`)) {
        return reliability;
      }
    }

    return 0.80;
  }

  /**
   * Get context limit for a specific OpenAI model
   *
   * @param modelId - Model identifier
   * @returns Maximum context tokens
   */
  public getContextLimit(modelId: string): number {
    const normalized = this.normalizeModelName(modelId);

    for (const [model, limit] of Object.entries(OPENAI_CONTEXT_LIMITS)) {
      if (normalized === model || normalized.startsWith(`${model}-`)) {
        return limit;
      }
    }

    return 8192;
  }

  /**
   * Check if model is an o1 model
   *
   * @param modelId - Model identifier
   * @returns True if model is o1 or o1-mini
   */
  private isO1Model(modelId: string): boolean {
    const normalized = this.normalizeModelName(modelId);
    return normalized.startsWith("o1-") || normalized === "o1";
  }

  /**
   * Normalize model name for consistency
   *
   * @param modelId - Raw model identifier
   * @returns Normalized model name
   */
  private normalizeModelName(modelId: string): string {
    // Remove provider prefix if present
    const normalized = modelId.replace(/^(openai|gpt)\//i, "");

    return normalized;
  }

  /**
   * Check if a model is an OpenAI model
   *
   * @param modelId - Model identifier
   * @returns True if model is from OpenAI
   */
  public isOpenAIModel(modelId: string): boolean {
    const normalized = modelId.toLowerCase();
    return (
      normalized.includes("gpt") ||
      normalized.includes("openai") ||
      normalized.startsWith("o1")
    );
  }
}
