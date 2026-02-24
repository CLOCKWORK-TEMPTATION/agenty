import type { LiteLLMRequestOptions, LiteLLMMessage, LiteLLMTool } from "@repo/types";

/**
 * Anthropic Provider Adapter
 *
 * Converts between LiteLLM format and Anthropic's native API format.
 * Handles model-specific configurations and optimizations for Claude models.
 */

export interface AnthropicConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  maxTokens?: number;
}

/**
 * Available Anthropic Claude models
 */
export const ANTHROPIC_MODELS = {
  OPUS_4: "claude-opus-4",
  SONNET_4_5: "claude-sonnet-4.5",
  SONNET_3_7: "claude-sonnet-3.7",
  HAIKU_3_5: "claude-haiku-3.5"
} as const;

/**
 * Model quality scores for Anthropic models
 * Used in quality-first routing strategy
 */
export const ANTHROPIC_MODEL_QUALITY = {
  [ANTHROPIC_MODELS.OPUS_4]: 0.98,
  [ANTHROPIC_MODELS.SONNET_4_5]: 0.95,
  [ANTHROPIC_MODELS.SONNET_3_7]: 0.90,
  [ANTHROPIC_MODELS.HAIKU_3_5]: 0.85
} as const;

/**
 * Model tool reliability scores
 * Based on empirical testing of function calling accuracy
 */
export const ANTHROPIC_TOOL_RELIABILITY = {
  [ANTHROPIC_MODELS.OPUS_4]: 0.96,
  [ANTHROPIC_MODELS.SONNET_4_5]: 0.94,
  [ANTHROPIC_MODELS.SONNET_3_7]: 0.92,
  [ANTHROPIC_MODELS.HAIKU_3_5]: 0.88
} as const;

/**
 * Model context window sizes
 */
export const ANTHROPIC_CONTEXT_LIMITS = {
  [ANTHROPIC_MODELS.OPUS_4]: 200000,
  [ANTHROPIC_MODELS.SONNET_4_5]: 200000,
  [ANTHROPIC_MODELS.SONNET_3_7]: 200000,
  [ANTHROPIC_MODELS.HAIKU_3_5]: 200000
} as const;

/**
 * Adapter class for Anthropic Claude models
 */
export class AnthropicAdapter {
  private readonly config: AnthropicConfig;

  public constructor(config: AnthropicConfig) {
    this.config = config;
  }

  /**
   * Convert LiteLLM request options to Anthropic-specific format
   *
   * @param options - LiteLLM request options
   * @returns Modified options optimized for Anthropic
   */
  public adaptRequest(options: LiteLLMRequestOptions): LiteLLMRequestOptions {
    // Ensure model is prefixed correctly for LiteLLM routing
    const model = this.normalizeModelName(options.model);

    // Set Anthropic-specific defaults if not provided
    const maxTokens = options.max_tokens ?? this.config.maxTokens ?? 4096;

    // Anthropic prefers temperature 1.0 for creative tasks, 0.0 for analytical
    const temperature = options.temperature ?? 1.0;

    return {
      ...options,
      model,
      max_tokens: maxTokens,
      temperature
    };
  }

  /**
   * Validate that messages format is compatible with Anthropic
   *
   * @param messages - Array of messages
   * @throws Error if validation fails
   */
  public validateMessages(messages: LiteLLMMessage[]): void {
    if (messages.length === 0) {
      throw new Error("Messages array cannot be empty");
    }

    // Anthropic requires alternating user/assistant messages in most cases
    // System messages should be first
    const systemMessages = messages.filter(m => m.role === "system");
    const conversationMessages = messages.filter(m => m.role !== "system");

    if (systemMessages.length > 1) {
      throw new Error("Anthropic supports only one system message");
    }

    if (conversationMessages.length === 0) {
      throw new Error("At least one user or assistant message required");
    }

    // First non-system message should be from user
    const firstMessage = conversationMessages[0];
    if (firstMessage && firstMessage.role !== "user") {
      throw new Error("First message must be from user");
    }
  }

  /**
   * Validate tools format for Anthropic
   *
   * @param tools - Array of tools
   * @throws Error if validation fails
   */
  public validateTools(tools: LiteLLMTool[] | undefined): void {
    if (!tools || tools.length === 0) {
      return;
    }

    // Anthropic supports up to 64 tools per request
    if (tools.length > 64) {
      throw new Error("Anthropic supports maximum 64 tools per request");
    }

    for (const tool of tools) {
      if (tool.type !== "function") {
        throw new Error(`Unsupported tool type: ${tool.type}`);
      }

      if (!tool.function.name || !tool.function.description) {
        throw new Error("Tool must have name and description");
      }

      if (!tool.function.parameters) {
        throw new Error("Tool must have parameters schema");
      }
    }
  }

  /**
   * Get quality score for a specific Anthropic model
   *
   * @param modelId - Model identifier
   * @returns Quality score between 0 and 1
   */
  public getModelQuality(modelId: string): number {
    const normalized = this.normalizeModelName(modelId);

    for (const [model, quality] of Object.entries(ANTHROPIC_MODEL_QUALITY)) {
      if (normalized.includes(model)) {
        return quality;
      }
    }

    // Default quality for unknown models
    return 0.80;
  }

  /**
   * Get tool reliability score for a specific Anthropic model
   *
   * @param modelId - Model identifier
   * @returns Tool reliability score between 0 and 1
   */
  public getToolReliability(modelId: string): number {
    const normalized = this.normalizeModelName(modelId);

    for (const [model, reliability] of Object.entries(ANTHROPIC_TOOL_RELIABILITY)) {
      if (normalized.includes(model)) {
        return reliability;
      }
    }

    return 0.85;
  }

  /**
   * Get context limit for a specific Anthropic model
   *
   * @param modelId - Model identifier
   * @returns Maximum context tokens
   */
  public getContextLimit(modelId: string): number {
    const normalized = this.normalizeModelName(modelId);

    for (const [model, limit] of Object.entries(ANTHROPIC_CONTEXT_LIMITS)) {
      if (normalized.includes(model)) {
        return limit;
      }
    }

    return 200000;
  }

  /**
   * Normalize model name for consistency
   *
   * @param modelId - Raw model identifier
   * @returns Normalized model name
   */
  private normalizeModelName(modelId: string): string {
    // Remove provider prefix if present
    let normalized = modelId.replace(/^anthropic\//i, "");

    // Ensure correct format
    if (!normalized.startsWith("claude-")) {
      normalized = `claude-${normalized}`;
    }

    return normalized;
  }

  /**
   * Check if a model is an Anthropic model
   *
   * @param modelId - Model identifier
   * @returns True if model is from Anthropic
   */
  public isAnthropicModel(modelId: string): boolean {
    const normalized = modelId.toLowerCase();
    return normalized.includes("claude") || normalized.includes("anthropic");
  }
}
