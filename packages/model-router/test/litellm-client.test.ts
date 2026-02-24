import { describe, it, expect } from "vitest";
import { LiteLLMClient } from "../src/litellm-client.js";
import type { LiteLLMClientConfig, LiteLLMRoutingPool } from "@repo/types";

describe("LiteLLMClient", () => {
  it("should initialize with default config", () => {
    const config: LiteLLMClientConfig = {
      baseUrl: "http://localhost:4000"
    };

    const client = new LiteLLMClient(config);
    expect(client).toBeDefined();
  });

  it("should initialize with full config", () => {
    const config: LiteLLMClientConfig = {
      baseUrl: "http://localhost:4000",
      apiKey: "test-key",
      timeout: 60000,
      maxRetries: 5
    };

    const client = new LiteLLMClient(config);
    expect(client).toBeDefined();
  });

  it("should initialize with default routing pool", () => {
    const pool: LiteLLMRoutingPool = {
      poolId: "test-pool",
      models: ["claude-opus-4", "gpt-4o"],
      routingStrategy: "quality-first",
      fallbackEnabled: true,
      maxRetries: 3
    };

    const config: LiteLLMClientConfig = {
      baseUrl: "http://localhost:4000",
      defaultRoutingPool: pool
    };

    const client = new LiteLLMClient(config);
    expect(client).toBeDefined();
  });
});
