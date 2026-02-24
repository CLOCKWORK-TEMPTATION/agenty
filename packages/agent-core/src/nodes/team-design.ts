import type { RoleAssignment, RoleBlueprint } from "@repo/types";

export interface TeamDesignState {
  roles: RoleBlueprint[];
  assignments: RoleAssignment[];
  events: string[];
}

export interface TeamDesignUpdate {
  assignments?: RoleAssignment[];
  events?: string[];
}

export function teamDesignNode(state: TeamDesignState): TeamDesignUpdate {
  if (!state.roles || state.roles.length === 0) {
    throw new Error("No roles available for team design");
  }

  const assignments: RoleAssignment[] = state.roles.map((role) => ({
    roleId: role.id,
    agentId: `${role.id}-agent`,
    model: "",
    tools: [],
    skills: []
  }));

  return {
    assignments,
    events: ["team_design.completed"]
  };
}
