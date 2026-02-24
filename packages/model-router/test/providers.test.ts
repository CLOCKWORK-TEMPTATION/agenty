import { describe, it, expect } from "vitest";
import {
  AnthropicAdapter,
  OpenAIAdapter,
  GoogleAdapter,
  ANTHROPIC_MODELS,
  OPENAI_MODELS,
  GOOGLE_MODELS
} from "../src/providers/index.js";
import type { LiteLLMRequestOptions } from "@repo/types";

describe("AnthropicAdapter", () => {
  const adapter = new AnthropicAdapter({
    apiKey: "test-key"
  });

  it("should normalize model names", () => {
    const request: LiteLLMRequestOptions = {
      model: "anthropic/opus-4",
      messages: [{ role: "user", content: "Hello" }]
    };

    const adapted = adapter.adaptRequest(request);
    expect(adapted.model).toBe("claude-opus-4");
  });

  it("should return quality score for Claude models", () => {
    const quality = adapter.getModelQuality(ANTHROPIC_MODELS.OPUS_4);
    expect(quality).toBeGreaterThan(0.9);
    expect(quality).toBeLessThanOrEqual(1.0);
  });

  it("should return tool reliability score", () => {
    const reliability = adapter.getToolReliability(ANTHROPIC_MODELS.SONNET_4_5);
    expect(reliability).toBeGreaterThan(0.8);
    expect(reliability).toBeLessThanOrEqual(1.0);
  });

  it("should return context limit", () => {
    const limit = adapter.getContextLimit(ANTHROPIC_MODELS.OPUS_4);
    expect(limit).toBe(200000);
  });

  it("should identify Anthropic models", () => {
    expect(adapter.isAnthropicModel("claude-opus-4")).toBe(true);
    expect(adapter.isAnthropicModel("anthropic/sonnet-4.5")).toBe(true);
    expect(adapter.isAnthropicModel("gpt-4o")).toBe(false);
  });

  it("should validate messages correctly", () => {
    const validMessages = [
      { role: "user" as const, content: "Hello" }
    ];

    expect(() => adapter.validateMessages(validMessages)).not.toThrow();

    const emptyMessages: never[] = [];
    expect(() => adapter.validateMessages(emptyMessages)).toThrow("Messages array cannot be empty");
  });
});

describe("OpenAIAdapter", () => {
  const adapter = new OpenAIAdapter({
    apiKey: "test-key"
  });

  it("should normalize model names", () => {
    const request: LiteLLMRequestOptions = {
      model: "openai/gpt-4o",
      messages: [{ role: "user", content: "Hello" }]
    };

    const adapted = adapter.adaptRequest(request);
    expect(adapted.model).toBe("gpt-4o");
  });

  it("should return quality score for GPT models", () => {
    const quality = adapter.getModelQuality(OPENAI_MODELS.GPT_4O);
    expect(quality).toBeGreaterThan(0.9);
    expect(quality).toBeLessThanOrEqual(1.0);
  });

  it("should return tool reliability score", () => {
    const reliability = adapter.getToolReliability(OPENAI_MODELS.GPT_4O);
    expect(reliability).toBeGreaterThan(0.9);
    expect(reliability).toBeLessThanOrEqual(1.0);
  });

  it("should return context limit", () => {
    const limit = adapter.getContextLimit(OPENAI_MODELS.GPT_4O);
    expect(limit).toBe(128000);
  });

  it("should identify OpenAI models", () => {
    expect(adapter.isOpenAIModel("gpt-4o")).toBe(true);
    expect(adapter.isOpenAIModel("openai/gpt-4-turbo")).toBe(true);
    expect(adapter.isOpenAIModel("o1")).toBe(true);
    expect(adapter.isOpenAIModel("claude-opus-4")).toBe(false);
  });

  it("should handle o1 models specially", () => {
    const request: LiteLLMRequestOptions = {
      model: "o1",
      messages: [
        { role: "system", content: "You are helpful" },
        { role: "user", content: "Hello" }
      ],
      temperature: 0.7
    };

    const adapted = adapter.adaptRequest(request);

    // o1 models should not have temperature
    expect(adapted.temperature).toBeUndefined();

    // System messages should be merged into first user message
    expect(adapted.messages.some((m) => m.role === "system")).toBe(false);
  });
});

describe("GoogleAdapter", () => {
  const adapter = new GoogleAdapter({
    apiKey: "test-key"
  });

  it("should normalize model names", () => {
    const request: LiteLLMRequestOptions = {
      model: "google/2.0-flash",
      messages: [{ role: "user", content: "Hello" }]
    };

    const adapted = adapter.adaptRequest(request);
    expect(adapted.model).toBe("gemini-2.0-flash");
  });

  it("should return quality score for Gemini models", () => {
    const quality = adapter.getModelQuality(GOOGLE_MODELS.GEMINI_2_0_FLASH);
    expect(quality).toBeGreaterThan(0.9);
    expect(quality).toBeLessThanOrEqual(1.0);
  });

  it("should return tool reliability score", () => {
    const reliability = adapter.getToolReliability(GOOGLE_MODELS.GEMINI_2_0_FLASH);
    expect(reliability).toBeGreaterThan(0.9);
    expect(reliability).toBeLessThanOrEqual(1.0);
  });

  it("should return context limit", () => {
    const limit = adapter.getContextLimit(GOOGLE_MODELS.GEMINI_1_5_PRO);
    expect(limit).toBe(2000000);
  });

  it("should identify Google models", () => {
    expect(adapter.isGoogleModel("gemini-2.0-flash")).toBe(true);
    expect(adapter.isGoogleModel("google/gemini-1.5-pro")).toBe(true);
    expect(adapter.isGoogleModel("gpt-4o")).toBe(false);
  });

  it("should support multimodal capabilities", () => {
    expect(adapter.supportsMultimodal(GOOGLE_MODELS.GEMINI_2_0_FLASH)).toBe(true);
    expect(adapter.supportsMultimodal(GOOGLE_MODELS.GEMINI_1_5_PRO)).toBe(true);
  });
});
