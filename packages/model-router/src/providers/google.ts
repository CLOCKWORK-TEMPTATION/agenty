import type { LiteLLMRequestOptions, LiteLLMMessage, LiteLLMTool } from "@repo/types";

/**
 * Google Provider Adapter
 *
 * Converts between LiteLLM format and Google's Gemini API format.
 * Handles model-specific configurations and optimizations for Gemini models.
 */

export interface GoogleConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
}

/**
 * Available Google Gemini models
 */
export const GOOGLE_MODELS = {
  GEMINI_2_0_FLASH: "gemini-2.0-flash",
  GEMINI_2_0_FLASH_THINKING: "gemini-2.0-flash-thinking-exp",
  GEMINI_1_5_PRO: "gemini-1.5-pro",
  GEMINI_1_5_FLASH: "gemini-1.5-flash",
  GEMINI_1_5_FLASH_8B: "gemini-1.5-flash-8b"
} as const;

/**
 * Model quality scores for Google models
 * Used in quality-first routing strategy
 */
export const GOOGLE_MODEL_QUALITY = {
  [GOOGLE_MODELS.GEMINI_2_0_FLASH_THINKING]: 0.96,
  [GOOGLE_MODELS.GEMINI_2_0_FLASH]: 0.93,
  [GOOGLE_MODELS.GEMINI_1_5_PRO]: 0.92,
  [GOOGLE_MODELS.GEMINI_1_5_FLASH]: 0.88,
  [GOOGLE_MODELS.GEMINI_1_5_FLASH_8B]: 0.84
} as const;

/**
 * Model tool reliability scores
 * Based on empirical testing of function calling accuracy
 */
export const GOOGLE_TOOL_RELIABILITY = {
  [GOOGLE_MODELS.GEMINI_2_0_FLASH_THINKING]: 0.91,
  [GOOGLE_MODELS.GEMINI_2_0_FLASH]: 0.93,
  [GOOGLE_MODELS.GEMINI_1_5_PRO]: 0.92,
  [GOOGLE_MODELS.GEMINI_1_5_FLASH]: 0.90,
  [GOOGLE_MODELS.GEMINI_1_5_FLASH_8B]: 0.87
} as const;

/**
 * Model context window sizes
 */
export const GOOGLE_CONTEXT_LIMITS = {
  [GOOGLE_MODELS.GEMINI_2_0_FLASH_THINKING]: 1000000,
  [GOOGLE_MODELS.GEMINI_2_0_FLASH]: 1000000,
  [GOOGLE_MODELS.GEMINI_1_5_PRO]: 2000000,
  [GOOGLE_MODELS.GEMINI_1_5_FLASH]: 1000000,
  [GOOGLE_MODELS.GEMINI_1_5_FLASH_8B]: 1000000
} as const;

/**
 * Adapter class for Google Gemini models
 */
export class GoogleAdapter {
  private readonly config: GoogleConfig;

  public constructor(config: GoogleConfig) {
    this.config = config;
  }

  /**
   * Convert LiteLLM request options to Google-specific format
   *
   * @param options - LiteLLM request options
   * @returns Modified options optimized for Google
   */
  public adaptRequest(options: LiteLLMRequestOptions): LiteLLMRequestOptions {
    const model = this.normalizeModelName(options.model);

    // Handle thinking models which may need special configuration
    if (this.isThinkingModel(model)) {
      return this.adaptThinkingRequest(options, model);
    }

    // Standard Gemini models
    const temperature = options.temperature ?? 0.9; // Gemini default
    const maxTokens = options.max_tokens ?? 8192;
    const topP = options.top_p ?? 1.0;

    // Suppress unused variable warning
    void this.config;

    return {
      ...options,
      model,
      temperature,
      max_tokens: maxTokens,
      top_p: topP
    };
  }

  /**
   * Adapt request for thinking models which may have special behavior
   *
   * @param options - LiteLLM request options
   * @param model - Normalized model name
   * @returns Modified options for thinking models
   */
  private adaptThinkingRequest(
    options: LiteLLMRequestOptions,
    model: string
  ): LiteLLMRequestOptions {
    // Thinking models benefit from lower temperature for reasoning
    const temperature = options.temperature ?? 0.5;

    return {
      ...options,
      model,
      temperature
    };
  }

  /**
   * Validate that messages format is compatible with Google
   *
   * @param messages - Array of messages
   * @throws Error if validation fails
   */
  public validateMessages(messages: LiteLLMMessage[]): void {
    if (messages.length === 0) {
      throw new Error("Messages array cannot be empty");
    }

    // Google Gemini supports system, user, and model (assistant) roles
    for (const message of messages) {
      if (!["system", "user", "assistant"].includes(message.role)) {
        throw new Error(`Invalid message role for Google: ${message.role}`);
      }
    }

    // Gemini requires at least one user message
    const hasUserMessage = messages.some(m => m.role === "user");
    if (!hasUserMessage) {
      throw new Error("At least one user message is required");
    }

    // System messages should be first if present
    const systemMessageIndex = messages.findIndex(m => m.role === "system");
    if (systemMessageIndex > 0) {
      throw new Error("System message must be first if present");
    }
  }

  /**
   * Validate tools format for Google
   *
   * @param tools - Array of tools
   * @throws Error if validation fails
   */
  public validateTools(tools: LiteLLMTool[] | undefined): void {
    if (!tools || tools.length === 0) {
      return;
    }

    // Gemini supports function calling
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
   * Get quality score for a specific Google model
   *
   * @param modelId - Model identifier
   * @returns Quality score between 0 and 1
   */
  public getModelQuality(modelId: string): number {
    const normalized = this.normalizeModelName(modelId);

    for (const [model, quality] of Object.entries(GOOGLE_MODEL_QUALITY)) {
      if (normalized === model || normalized.startsWith(`${model}-`)) {
        return quality;
      }
    }

    return 0.82;
  }

  /**
   * Get tool reliability score for a specific Google model
   *
   * @param modelId - Model identifier
   * @returns Tool reliability score between 0 and 1
   */
  public getToolReliability(modelId: string): number {
    const normalized = this.normalizeModelName(modelId);

    for (const [model, reliability] of Object.entries(GOOGLE_TOOL_RELIABILITY)) {
      if (normalized === model || normalized.startsWith(`${model}-`)) {
        return reliability;
      }
    }

    return 0.85;
  }

  /**
   * Get context limit for a specific Google model
   *
   * @param modelId - Model identifier
   * @returns Maximum context tokens
   */
  public getContextLimit(modelId: string): number {
    const normalized = this.normalizeModelName(modelId);

    for (const [model, limit] of Object.entries(GOOGLE_CONTEXT_LIMITS)) {
      if (normalized === model || normalized.startsWith(`${model}-`)) {
        return limit;
      }
    }

    return 1000000;
  }

  /**
   * Check if model is a thinking model
   *
   * @param modelId - Model identifier
   * @returns True if model is a thinking variant
   */
  private isThinkingModel(modelId: string): boolean {
    const normalized = this.normalizeModelName(modelId);
    return normalized.includes("thinking");
  }

  /**
   * Normalize model name for consistency
   *
   * @param modelId - Raw model identifier
   * @returns Normalized model name
   */
  private normalizeModelName(modelId: string): string {
    // Remove provider prefix if present
    let normalized = modelId.replace(/^(google|gemini)\//i, "");

    // Ensure correct format
    if (!normalized.startsWith("gemini-")) {
      normalized = `gemini-${normalized}`;
    }

    return normalized;
  }

  /**
   * Check if a model is a Google model
   *
   * @param modelId - Model identifier
   * @returns True if model is from Google
   */
  public isGoogleModel(modelId: string): boolean {
    const normalized = modelId.toLowerCase();
    return normalized.includes("gemini") || normalized.includes("google");
  }

  /**
   * Get multimodal capabilities for a model
   *
   * @param modelId - Model identifier
   * @returns True if model supports multimodal inputs (images, audio, video)
   */
  public supportsMultimodal(modelId: string): boolean {
    // All Gemini 1.5+ models support multimodal
    const normalized = this.normalizeModelName(modelId);
    return (
      normalized.includes("1.5") ||
      normalized.includes("2.0") ||
      normalized.includes("pro") ||
      normalized.includes("flash")
    );
  }
}
