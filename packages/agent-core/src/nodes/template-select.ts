import type { RoleBlueprint, TeamTemplate } from "@repo/types";

export interface TemplateSelectState {
  template: TeamTemplate;
  roles: RoleBlueprint[];
  events: string[];
}

export interface TemplateSelectUpdate {
  roles?: RoleBlueprint[];
  events?: string[];
}

export function templateSelectNode(state: TemplateSelectState): TemplateSelectUpdate {
  if (!state.template) {
    throw new Error("Template is required in template_select node");
  }

  if (!state.template.roles || state.template.roles.length === 0) {
    throw new Error("Template must contain at least one role");
  }

  const validatedRoles = state.template.roles.map((role) => {
    if (!role.id || !role.name || !role.objective) {
      throw new Error(`Invalid role definition: ${JSON.stringify(role)}`);
    }

    return {
      ...role,
      requiredCapabilities: role.requiredCapabilities || []
    };
  });

  return {
    roles: validatedRoles,
    events: ["template_select.completed"]
  };
}
