import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { SkillRegistry } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const basePath = resolve(__dirname, "..", "..", "..", "skills");

describe("skills-engine", () => {
  it("discovers metadata without loading full skill", async () => {
    const registry = new SkillRegistry();
    await registry.discover(basePath);
    const skills = registry.list();
    expect(skills.length).toBeGreaterThan(0);
    const first = skills[0];
    if (!first) {
      throw new Error("Expected at least one discovered skill");
    }
    expect(registry.isActivated(first.id)).toBe(false);
  });

  it("loads skill content only when activated", async () => {
    const registry = new SkillRegistry();
    await registry.discover(basePath);
    const activated = await registry.activate("orchestrator-core");
    expect(activated.content.length).toBeGreaterThan(0);
    expect(registry.isActivated("orchestrator-core")).toBe(true);
  });

  describe("hot-update", () => {
    let tempDir: string;

    afterAll(async () => {
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it("supports hot-update for skill file", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "skills-test-"));
      const skillDir = join(tempDir, "core", "orchestrator-core");
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, "SKILL.md"), "# Orchestrator\nupdated\n");

      const registry = new SkillRegistry();
      await registry.discover(tempDir);
      const skill = await registry.activate("orchestrator-core");
      expect(skill.content).toContain("updated");
    });
  });
});
