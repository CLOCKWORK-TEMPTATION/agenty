import type { ModelDecision, RoleAssignment, RoleBlueprint } from "@repo/types";
import type { ToolBroker } from "@repo/tool-broker";

export interface ToolsAllocateState {
  roles: RoleBlueprint[];
  modelDecisions: ModelDecision[];
  assignments: RoleAssignment[];
  events: string[];
}

export interface ToolsAllocateUpdate {
  assignments?: RoleAssignment[];
  events?: string[];
}

export interface ToolsAllocateDependencies {
  toolBroker: ToolBroker;
}

export function createToolsAllocateNode(deps: ToolsAllocateDependencies) {
  return function toolsAllocateNode(state: ToolsAllocateState): ToolsAllocateUpdate {
    if (!state.roles || state.roles.length === 0) {
      throw new Error("No roles available for tool allocation");
    }

    if (!state.modelDecisions || state.modelDecisions.length === 0) {
      throw new Error("No model decisions available for tool allocation");
    }

    const allTools = deps.toolBroker.listCatalog();

    const assignments: RoleAssignment[] = state.roles.map((role) => {
      const decision = state.modelDecisions.find((item) => item.roleId === role.id);
      if (!decision) {
        throw new Error(`Missing model decision for role ${role.id}`);
      }

      const roleTools = allocateToolsForRole(role, allTools.map((tool) => tool.name));

      return {
        roleId: role.id,
        agentId: `${role.id}-agent`,
        model: decision.selectedModel,
        tools: roleTools,
        skills: []
      };
    });

    return {
      assignments,
      events: ["tools_allocate.completed"]
    };
  };
}

function allocateToolsForRole(role: RoleBlueprint, availableTools: string[]): string[] {
  const allocated: string[] = [];

  const needsCodeTools = role.requiredCapabilities.includes("code-generation");
  const needsDataTools = role.requiredCapabilities.includes("data-analysis");
  const needsSearchTools = role.requiredCapabilities.includes("research");

  for (const toolName of availableTools) {
    if (toolName.includes("filesystem") || toolName.includes("file")) {
      allocated.push(toolName);
    }

    if (needsCodeTools && (toolName.includes("code") || toolName.includes("git"))) {
      allocated.push(toolName);
    }

    if (needsDataTools && (toolName.includes("database") || toolName.includes("sql"))) {
      allocated.push(toolName);
    }

    if (needsSearchTools && (toolName.includes("search") || toolName.includes("web"))) {
      allocated.push(toolName);
    }
  }

  if (allocated.length === 0) {
    return availableTools;
  }

  return [...new Set(allocated)];
}
