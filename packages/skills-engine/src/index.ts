import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

export interface SkillMetadata {
  id: string;
  category: string;
  path: string;
}

export interface SkillDefinition extends SkillMetadata {
  content: string;
}

export class SkillRegistry {
  private readonly metadata = new Map<string, SkillMetadata>();
  private readonly loadedSkills = new Map<string, SkillDefinition>();

  public async discover(basePath: string): Promise<SkillMetadata[]> {
    const categories = await readdir(basePath);
    const result: SkillMetadata[] = [];

    for (const category of categories) {
      const categoryPath = join(basePath, category);
      const categoryStat = await stat(categoryPath);
      if (!categoryStat.isDirectory()) {
        continue;
      }
      const entries = await readdir(categoryPath);
      for (const entry of entries) {
        const skillPath = join(categoryPath, entry);
        const skillStat = await stat(skillPath);
        if (!skillStat.isDirectory()) {
          continue;
        }
        const metadata: SkillMetadata = {
          id: entry,
          category,
          path: skillPath
        };
        this.metadata.set(entry, metadata);
        result.push(metadata);
      }
    }

    return result;
  }

  public list(): SkillMetadata[] {
    return Array.from(this.metadata.values());
  }

  public async activate(skillId: string): Promise<SkillDefinition> {
    const existing = this.loadedSkills.get(skillId);
    if (existing) {
      return existing;
    }

    const metadata = this.metadata.get(skillId);
    if (!metadata) {
      throw new Error(`Unknown skill ${skillId}`);
    }

    const file = join(metadata.path, "SKILL.md");
    const content = await readFile(file, "utf-8");
    const definition: SkillDefinition = {
      ...metadata,
      content
    };
    this.loadedSkills.set(skillId, definition);
    return definition;
  }

  public isActivated(skillId: string): boolean {
    return this.loadedSkills.has(skillId);
  }
}

export const defaultSkillActivationPolicy = (domain: string): string[] => {
  if (domain === "coding") {
    return ["orchestrator-core", "planner-core", "verifier-core", "finalizer-core"];
  }
  if (domain === "research") {
    return ["orchestrator-core", "planner-core", "verifier-core"];
  }
  return ["orchestrator-core", "finalizer-core"];
};
