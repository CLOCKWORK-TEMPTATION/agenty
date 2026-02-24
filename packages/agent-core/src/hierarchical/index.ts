/**
 * Hierarchical Orchestration - Index
 * Exports all hierarchical orchestration functionality
 */

export {
  HierarchicalOrchestrator,
  createHierarchicalOrchestrator
} from "./orchestrator.js";

export type {
  HierarchicalOrchestratorConfig,
  SubTaskResult,
  DelegationDecision
} from "./orchestrator.js";

// Re-export types from @repo/types for convenience
export type {
  HierarchicalTeam,
  DelegationRule,
  SubTaskRequest,
  TeamHierarchyResult
} from "@repo/types";
