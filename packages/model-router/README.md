# Model Router Package

LiteLLM-based model routing and provider adapter library for quality-first multi-model orchestration.

## Features

- **LiteLLM Client Wrapper**: Unified interface for all LLM providers
- **Provider Adapters**: Specialized adapters for Anthropic, OpenAI, and Google models
- **Quality-First Routing**: Route requests based on model quality scores (NOT cost)
- **Automatic Fallback**: Built-in retry and fallback chain handling
- **Streaming Support**: Full support for streaming responses
- **Tool Calling**: Validated tool calling across all providers
- **Model Diversity**: Enforcement of minimum unique models per team

## Installation

This is a workspace package and is automatically linked via pnpm workspaces.

```bash
pnpm install
```

## Architecture

### LiteLLM Client

The `LiteLLMClient` class provides a unified interface for making requests to LiteLLM proxy server.

Key features:
- Routing pools with fallback chains
- Automatic retries with exponential backoff
- Support for streaming responses
- Quality-first, round-robin, and latency-based routing strategies
- Proper error handling with `AppError` and retryable flags

### Provider Adapters

Provider adapters handle model-specific configurations and optimizations:

#### AnthropicAdapter
- Claude Opus 4, Sonnet 4.5, Sonnet 3.7, Haiku 3.5
- Quality scores: 0.85 - 0.98
- Tool reliability: 0.88 - 0.96
- Context limit: 200K tokens

#### OpenAIAdapter
- GPT-4o, GPT-4 Turbo, o1, o1-mini, GPT-3.5 Turbo
- Quality scores: 0.80 - 0.97
- Tool reliability: 0.85 - 0.95
- Special handling for o1 models (no temperature, no system messages)
- Context limit: 8K - 200K tokens

#### GoogleAdapter
- Gemini 2.0 Flash, Gemini 1.5 Pro, Gemini 1.5 Flash
- Quality scores: 0.84 - 0.96
- Tool reliability: 0.87 - 0.93
- Multimodal support
- Context limit: 1M - 2M tokens

## Usage

### Basic Chat Completion

```typescript
import { LiteLLMClient } from "@repo/model-router";
import type { LiteLLMRequestOptions } from "@repo/types";

const client = new LiteLLMClient({
  baseUrl: "http://localhost:4000",
  apiKey: process.env.LITELLM_API_KEY,
  timeout: 30000,
  maxRetries: 3
});

const request: LiteLLMRequestOptions = {
  model: "claude-sonnet-4.5",
  messages: [
    { role: "user", content: "Hello, how are you?" }
  ],
  temperature: 0.7,
  max_tokens: 2048
};

const response = await client.chatCompletion(request);
console.log(response.choices[0]?.message.content);
```

### Quality-First Routing with Fallback

```typescript
import type { LiteLLMRoutingPool } from "@repo/types";

const routingPool: LiteLLMRoutingPool = {
  poolId: "high-quality-pool",
  models: ["claude-opus-4", "gpt-4o", "gemini-2.0-flash"],
  routingStrategy: "quality-first",
  fallbackEnabled: true,
  maxRetries: 3
};

const response = await client.chatCompletion(request, routingPool);
```

### Using Provider Adapters

```typescript
import { AnthropicAdapter } from "@repo/model-router";

const adapter = new AnthropicAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY ?? ""
});

// Validate messages
adapter.validateMessages(request.messages);

// Adapt request for Anthropic
const adaptedRequest = adapter.adaptRequest(request);

// Get model metrics
const quality = adapter.getModelQuality("claude-opus-4"); // 0.98
const toolReliability = adapter.getToolReliability("claude-opus-4"); // 0.96
const contextLimit = adapter.getContextLimit("claude-opus-4"); // 200000
```

### Streaming Responses

```typescript
for await (const chunk of client.chatCompletionStream(request)) {
  const content = chunk.choices[0]?.delta.content;
  if (content) {
    process.stdout.write(content);
  }
}
```

### Tool Calling

```typescript
const request: LiteLLMRequestOptions = {
  model: "gpt-4o",
  messages: [
    { role: "user", content: "What's the weather in SF?" }
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "get_weather",
        description: "Get current weather",
        parameters: {
          type: "object",
          properties: {
            location: { type: "string" }
          },
          required: ["location"]
        }
      }
    }
  ],
  tool_choice: "auto"
};

const response = await client.chatCompletion(request);
```

## Quality-First Model Selection

The routing strategy uses the following scoring formula:

```
score = quality(0.65) + tool_reliability(0.20) + capability_fit(0.10) + latency_reliability(0.05)
```

**Important**: Cost is NEVER a factor in model selection.

### Model Diversity Enforcement

Teams must use at least 2 different models:

```typescript
import { enforceModelDiversity } from "@repo/model-router";

enforceModelDiversity(modelDecisions, 2); // Minimum 2 unique models
```

## Error Handling

All errors are wrapped in `AppError` with proper metadata:

```typescript
try {
  const response = await client.chatCompletion(request);
} catch (error) {
  if (error instanceof AppError) {
    console.error("Error code:", error.errorCode);
    console.error("Retryable:", error.retryable);
    console.error("Trace ID:", error.traceId);
    console.error("Details:", error.details);
  }
}
```

Retryable errors include:
- Network errors
- Timeout errors
- Rate limit errors (429)
- Server errors (5xx)
- Service unavailable (503)

## Model Routing Functions

### scoreModel

Calculate quality score for a model:

```typescript
import { scoreModel } from "@repo/model-router";
import type { ModelProfile } from "@repo/types";

const model: ModelProfile = {
  id: "claude-opus-4",
  provider: "anthropic",
  quality: 0.98,
  toolReliability: 0.96,
  capabilityFit: 0.95,
  latencyReliability: 0.92,
  supportsTools: true,
  supportsStructuredOutput: true,
  maxContextTokens: 200000,
  languages: ["en", "ar"]
};

const score = scoreModel(model); // 0.97
```

### applyHardFilters

Filter models by requirements:

```typescript
import { applyHardFilters } from "@repo/model-router";

const candidates = applyHardFilters(catalog, {
  minContextTokens: 16384,
  requireTools: true,
  requireStructuredOutput: true,
  language: "en"
});
```

### routeRoleModel

Route a role to the best model:

```typescript
import { routeRoleModel } from "@repo/model-router";

const decision = routeRoleModel(role, taskProfile, catalog);
console.log("Selected model:", decision.selectedModel);
console.log("Fallback chain:", decision.fallbackChain);
```

## Testing

Run tests:

```bash
pnpm run test
```

Run type checking:

```bash
pnpm run typecheck
```

## Environment Variables

- `LITELLM_API_KEY`: API key for LiteLLM proxy (optional if using localhost)
- `ANTHROPIC_API_KEY`: Anthropic API key (for provider adapter validation)
- `OPENAI_API_KEY`: OpenAI API key (for provider adapter validation)
- `GOOGLE_API_KEY`: Google API key (for provider adapter validation)

## Development

Build the package:

```bash
pnpm run build
```

Watch mode:

```bash
pnpm run build --watch
```

Lint:

```bash
pnpm run lint
```

## Architecture Notes

- All exports use ES Modules (`.js` extensions in imports)
- TypeScript strict mode enabled
- No `any` types allowed
- Named exports only
- `AppError` for all error handling
- No cost tracking anywhere

## Related Packages

- `@repo/types`: Shared TypeScript types
- `@repo/agent-core`: Agent execution engine
- `@repo/tool-broker`: MCP tool management
