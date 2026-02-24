# Changelog

## [0.2.0] - 2026-02-24

### Added

- **LiteLLM Client Integration**
  - `LiteLLMClient` class for unified LLM provider access
  - Support for routing pools with fallback chains
  - Automatic retries with exponential backoff
  - Streaming response support
  - Quality-first, round-robin, and latency-based routing strategies
  - Proper error handling with `AppError` and retryable flags

- **Provider Adapters**
  - `AnthropicAdapter` for Claude models (Opus 4, Sonnet 4.5, Sonnet 3.7, Haiku 3.5)
  - `OpenAIAdapter` for GPT models (GPT-4o, o1, GPT-4 Turbo, etc.)
  - `GoogleAdapter` for Gemini models (2.0 Flash, 1.5 Pro, 1.5 Flash)
  - Model quality, tool reliability, and context limit metrics
  - Provider-specific request validation and optimization
  - Special handling for o1 models (no temperature, no system messages)
  - Multimodal support detection for Gemini models

- **Type Definitions**
  - `LiteLLMMessage`, `LiteLLMTool`, `LiteLLMToolCall` types
  - `LiteLLMRequestOptions` and `LiteLLMResponse` types
  - `LiteLLMStreamChunk` for streaming responses
  - `LiteLLMRoutingPool` and `LiteLLMClientConfig` types
  - `LiteLLMProvider` enum type

- **Documentation**
  - Comprehensive README with usage examples
  - Integration guide for connecting LiteLLM to the platform
  - Example LiteLLM configuration file
  - Test coverage for all new functionality

### Changed

- Exported LiteLLM client and provider adapters from main index
- Updated package structure to include `providers/` directory

### Technical Details

#### Model Quality Scores

**Anthropic:**
- Claude Opus 4: 0.98
- Claude Sonnet 4.5: 0.95
- Claude Sonnet 3.7: 0.90
- Claude Haiku 3.5: 0.85

**OpenAI:**
- o1: 0.97
- GPT-4o: 0.94
- o1-mini: 0.92
- GPT-4 Turbo: 0.91
- GPT-4: 0.89

**Google:**
- Gemini 2.0 Flash Thinking: 0.96
- Gemini 2.0 Flash: 0.93
- Gemini 1.5 Pro: 0.92
- Gemini 1.5 Flash: 0.88

#### Tool Reliability Scores

**Anthropic:** 0.88 - 0.96
**OpenAI:** 0.85 - 0.95
**Google:** 0.87 - 0.93

#### Context Limits

**Anthropic:** 200K tokens
**OpenAI:** 8K - 200K tokens (model-dependent)
**Google:** 1M - 2M tokens

### Testing

- 34 unit tests covering all functionality
- Tests for LiteLLM client initialization
- Tests for provider adapters (validation, quality scores, normalization)
- All tests passing with 100% coverage of critical paths

### Dependencies

No new dependencies added. Uses native `fetch` API for HTTP requests.

### Breaking Changes

None. This is a backwards-compatible addition to the existing model-router functionality.

---

## [0.1.0] - 2025-02-23

### Initial Release

- Quality-first model routing
- Model diversity enforcement
- Hard filtering by capabilities
- Model scoring algorithm
