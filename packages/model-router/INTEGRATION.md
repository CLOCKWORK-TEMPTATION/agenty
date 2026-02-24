# LiteLLM Integration Guide

This guide explains how to integrate the LiteLLM client into the Multi-Model Agent Teams Platform.

## Prerequisites

1. LiteLLM proxy server running (default: `http://localhost:4000`)
2. Provider API keys configured in environment variables
3. PostgreSQL and Redis running for LiteLLM state management

## Setup

### 1. Start Infrastructure

```bash
# Start PostgreSQL, Redis, and LiteLLM
docker compose up postgres redis litellm -d
```

### 2. Configure Environment Variables

Create `.env` file:

```bash
# LiteLLM
LITELLM_MASTER_KEY=sk-your-master-key-here
LITELLM_BASE_URL=http://localhost:4000

# Provider API Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/litellm

# Redis
REDIS_URL=redis://localhost:6379
```

### 3. Configure LiteLLM

Copy example config:

```bash
cp packages/model-router/litellm.config.example.yaml litellm.config.yaml
```

Edit `litellm.config.yaml` to add your provider API keys and adjust settings.

## Integration Points

### 1. Agent Core Integration

In `packages/agent-core/src/executor.ts`:

```typescript
import { LiteLLMClient } from "@repo/model-router";
import type { LiteLLMRequestOptions, LiteLLMRoutingPool } from "@repo/types";

export class AgentExecutor {
  private litellmClient: LiteLLMClient;

  constructor(config: AgentConfig) {
    this.litellmClient = new LiteLLMClient({
      baseUrl: config.litellmBaseUrl ?? "http://localhost:4000",
      timeout: 30000,
      maxRetries: 3
    });
  }

  async executeRole(
    role: RoleAssignment,
    context: ExecutionContext
  ): Promise<RoleOutput> {
    // Create routing pool with quality-first strategy
    const routingPool: LiteLLMRoutingPool = {
      poolId: `role-${role.roleId}`,
      models: [role.model, ...this.getFallbackModels(role.model)],
      routingStrategy: "quality-first",
      fallbackEnabled: true,
      maxRetries: 3
    };

    // Build request
    const request: LiteLLMRequestOptions = {
      model: role.model,
      messages: this.buildMessages(context),
      temperature: 0.7,
      max_tokens: 4096,
      tools: this.convertTools(role.tools)
    };

    // Execute with automatic fallback
    const response = await this.litellmClient.chatCompletion(
      request,
      routingPool
    );

    return this.parseResponse(response);
  }

  private getFallbackModels(primaryModel: string): string[] {
    // Return fallback chain based on model decisions
    // This is populated by model-router during team design
    return [];
  }
}
```

### 2. Model Router Integration

In `packages/model-router/src/index.ts`, the router now uses provider adapters:

```typescript
import {
  AnthropicAdapter,
  OpenAIAdapter,
  GoogleAdapter
} from "@repo/model-router";

export function buildModelCatalog(): ModelProfile[] {
  const anthropicAdapter = new AnthropicAdapter({
    apiKey: process.env.ANTHROPIC_API_KEY ?? ""
  });

  const openaiAdapter = new OpenAIAdapter({
    apiKey: process.env.OPENAI_API_KEY ?? ""
  });

  const googleAdapter = new GoogleAdapter({
    apiKey: process.env.GOOGLE_API_KEY ?? ""
  });

  return [
    // Anthropic models
    {
      id: "claude-opus-4",
      provider: "anthropic",
      quality: anthropicAdapter.getModelQuality("claude-opus-4"),
      toolReliability: anthropicAdapter.getToolReliability("claude-opus-4"),
      capabilityFit: 0.95,
      latencyReliability: 0.92,
      supportsTools: true,
      supportsStructuredOutput: true,
      maxContextTokens: anthropicAdapter.getContextLimit("claude-opus-4"),
      languages: ["en", "ar"]
    },
    // OpenAI models
    {
      id: "gpt-4o",
      provider: "openai",
      quality: openaiAdapter.getModelQuality("gpt-4o"),
      toolReliability: openaiAdapter.getToolReliability("gpt-4o"),
      capabilityFit: 0.93,
      latencyReliability: 0.94,
      supportsTools: true,
      supportsStructuredOutput: true,
      maxContextTokens: openaiAdapter.getContextLimit("gpt-4o"),
      languages: ["en", "ar"]
    },
    // Google models
    {
      id: "gemini-2.0-flash",
      provider: "google",
      quality: googleAdapter.getModelQuality("gemini-2.0-flash"),
      toolReliability: googleAdapter.getToolReliability("gemini-2.0-flash"),
      capabilityFit: 0.91,
      latencyReliability: 0.96,
      supportsTools: true,
      supportsStructuredOutput: true,
      maxContextTokens: googleAdapter.getContextLimit("gemini-2.0-flash"),
      languages: ["en", "ar"]
    }
  ];
}
```

### 3. Streaming in Real-Time UI

In `apps/web/src/components/TaskExecution.tsx`:

```typescript
import { LiteLLMClient } from "@repo/model-router";

async function streamTaskExecution(taskId: string) {
  const client = new LiteLLMClient({
    baseUrl: process.env.NEXT_PUBLIC_LITELLM_BASE_URL
  });

  const request = {
    model: "claude-sonnet-4.5",
    messages: [
      { role: "user", content: "Execute task..." }
    ],
    stream: true
  };

  for await (const chunk of client.chatCompletionStream(request)) {
    const content = chunk.choices[0]?.delta.content;
    if (content) {
      // Update UI with streaming content
      updateTaskOutput(taskId, content);
    }
  }
}
```

### 4. Tool Execution Integration

In `packages/tool-broker/src/executor.ts`:

```typescript
import { LiteLLMClient } from "@repo/model-router";
import { OpenAIAdapter } from "@repo/model-router";

export class ToolExecutor {
  private litellmClient: LiteLLMClient;
  private openaiAdapter: OpenAIAdapter;

  constructor() {
    this.litellmClient = new LiteLLMClient({
      baseUrl: process.env.LITELLM_BASE_URL ?? "http://localhost:4000"
    });

    this.openaiAdapter = new OpenAIAdapter({
      apiKey: process.env.OPENAI_API_KEY ?? ""
    });
  }

  async executeWithTools(
    model: string,
    messages: LiteLLMMessage[],
    tools: McpToolDescriptor[]
  ): Promise<ToolExecutionResult> {
    const litellmTools = this.convertMcpToLiteLLM(tools);

    // Validate tools
    this.openaiAdapter.validateTools(litellmTools);

    const request = {
      model,
      messages,
      tools: litellmTools,
      tool_choice: "auto"
    };

    const response = await this.litellmClient.chatCompletion(request);

    // Handle tool calls
    if (response.choices[0]?.message.tool_calls) {
      return this.executeMcpTools(response.choices[0].message.tool_calls);
    }

    return { content: response.choices[0]?.message.content };
  }
}
```

## Quality-First Routing

The platform uses quality-first routing strategy:

```typescript
// Quality scoring formula
score = quality(0.65) + tool_reliability(0.20) + capability_fit(0.10) + latency_reliability(0.05)

// Example scores:
// claude-opus-4:        0.97
// gpt-4o:               0.94
// gemini-2.0-flash:     0.93
// claude-sonnet-4.5:    0.95
```

When a request fails, LiteLLM automatically falls back to the next highest-quality model in the pool.

## Model Diversity Enforcement

Ensure at least 2 different models per team:

```typescript
import { enforceModelDiversity } from "@repo/model-router";

const decisions = [
  { roleId: "researcher", selectedModel: "claude-opus-4", ... },
  { roleId: "coder", selectedModel: "gpt-4o", ... },
  { roleId: "reviewer", selectedModel: "gemini-2.0-flash", ... }
];

enforceModelDiversity(decisions, 2); // Passes - 3 unique models
```

## Error Handling

All LiteLLM errors are wrapped in `AppError`:

```typescript
try {
  const response = await client.chatCompletion(request);
} catch (error) {
  if (error instanceof AppError) {
    // Log with trace ID
    console.error(`Request failed: ${error.message}`, {
      errorCode: error.errorCode,
      traceId: error.traceId,
      retryable: error.retryable
    });

    // Retry if retryable
    if (error.retryable) {
      // LiteLLM client already retries automatically
      // This is for higher-level retry logic if needed
    }
  }
}
```

## Monitoring

LiteLLM provides metrics at `http://localhost:9090/metrics`:

- Request latency per model
- Success/failure rates
- Retry counts
- Active requests
- **NO cost metrics** (intentionally disabled)

## Testing

Run integration tests:

```bash
# Unit tests
pnpm --filter @repo/model-router run test

# Integration tests (requires LiteLLM running)
pnpm --filter @repo/api run test:e2e
```

## Best Practices

1. **Always use routing pools** for critical operations
2. **Validate tools** before sending to LiteLLM
3. **Use provider adapters** for model-specific optimizations
4. **Monitor retry rates** to detect model availability issues
5. **Never track costs** - this is intentional product design
6. **Enforce model diversity** at team design phase
7. **Use streaming** for long-running tasks to improve UX

## Troubleshooting

### LiteLLM Connection Failed

```bash
# Check if LiteLLM is running
curl http://localhost:4000/health

# Check logs
docker logs litellm
```

### Provider API Key Invalid

```bash
# Verify environment variables
echo $ANTHROPIC_API_KEY
echo $OPENAI_API_KEY
echo $GOOGLE_API_KEY
```

### Model Not Found

Ensure model is defined in `litellm.config.yaml`:

```yaml
model_list:
  - model_name: claude-opus-4
    litellm_params:
      model: anthropic/claude-opus-4-20250514
      api_key: ${ANTHROPIC_API_KEY}
```

### High Retry Rate

Check model availability:

```bash
# Test specific model
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -d '{
    "model": "claude-opus-4",
    "messages": [{"role": "user", "content": "test"}]
  }'
```

## Next Steps

1. Configure LiteLLM with your provider API keys
2. Update `agent-core` to use LiteLLM client
3. Build model catalog using provider adapters
4. Test quality-first routing with real requests
5. Monitor metrics and adjust routing strategy if needed
