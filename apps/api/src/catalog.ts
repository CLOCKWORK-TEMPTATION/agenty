import type { ModelProfile, TeamTemplate } from "@repo/types";

export const modelCatalog: ModelProfile[] = [
  {
    id: "gpt-4.1",
    provider: "openai",
    quality: 0.95,
    toolReliability: 0.9,
    capabilityFit: 0.92,
    latencyReliability: 0.84,
    supportsTools: true,
    supportsStructuredOutput: true,
    maxContextTokens: 200000,
    languages: ["en", "ar"]
  },
  {
    id: "claude-3-7-sonnet",
    provider: "anthropic",
    quality: 0.94,
    toolReliability: 0.88,
    capabilityFit: 0.9,
    latencyReliability: 0.85,
    supportsTools: true,
    supportsStructuredOutput: true,
    maxContextTokens: 200000,
    languages: ["en", "ar"]
  },
  {
    id: "gemini-2.0-pro",
    provider: "google",
    quality: 0.9,
    toolReliability: 0.82,
    capabilityFit: 0.86,
    latencyReliability: 0.9,
    supportsTools: true,
    supportsStructuredOutput: true,
    maxContextTokens: 1048576,
    languages: ["en", "ar"]
  }
];

export const defaultTemplates: TeamTemplate[] = [
  {
    id: "coding-default",
    name: "Coding Team",
    version: "1.0.0",
    description: "Planner + Specialist + Verifier",
    domains: ["coding"],
    roles: [
      {
        id: "planner",
        name: "Planner",
        objective: "Break down implementation plan",
        requiredCapabilities: ["tool-calling"]
      },
      {
        id: "implementer",
        name: "Implementer",
        objective: "Implement the requested change",
        requiredCapabilities: ["tool-calling"]
      },
      {
        id: "verifier",
        name: "Verifier",
        objective: "Verify quality and risks",
        requiredCapabilities: ["tool-calling"]
      }
    ]
  },
  {
    id: "research-default",
    name: "Research Team",
    version: "1.0.0",
    description: "Research + Validation",
    domains: ["research"],
    roles: [
      {
        id: "researcher",
        name: "Researcher",
        objective: "Gather sources",
        requiredCapabilities: ["tool-calling"]
      },
      {
        id: "validator",
        name: "Validator",
        objective: "Validate claims",
        requiredCapabilities: ["tool-calling"]
      }
    ]
  }
];
