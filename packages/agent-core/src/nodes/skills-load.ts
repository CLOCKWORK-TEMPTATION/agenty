import type { RoleAssignment } from "@repo/types";
import type { SkillRegistry } from "@repo/skills-engine";

export interface SkillsLoadState {
  assignments: RoleAssignment[];
  events: string[];
}

export interface SkillsLoadUpdate {
  assignments?: RoleAssignment[];
  events?: string[];
}

export interface SkillsLoadDependencies {
  skillRegistry: SkillRegistry;
}

const CORE_SKILLS = ["orchestrator-core", "planner-core", "verifier-core", "finalizer-core"] as const;

export function createSkillsLoadNode(deps: SkillsLoadDependencies) {
  return async function skillsLoadNode(state: SkillsLoadState): Promise<SkillsLoadUpdate> {
    for (const id of CORE_SKILLS) {
      if (!deps.skillRegistry.isActivated(id)) {
        try {
          await deps.skillRegistry.activate(id);
        } catch (error) {
          if (error instanceof Error) {
            throw new Error(`Failed to activate skill ${id}: ${error.message}`);
          }
          throw new Error(`Failed to activate skill ${id}`);
        }
      }
    }

    const assignments = state.assignments.map((assignment) => ({
      ...assignment,
      skills: [...CORE_SKILLS]
    }));

    return {
      assignments,
      events: ["skills_load.completed"]
    };
  };
}
