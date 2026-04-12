import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createSkillsStorageService } from "./skills";

const tmpBase = join(import.meta.dirname, "__test-skills-tmp__");

const writeSkill = (dir: string, name: string, description: string) => {
  const skillDir = join(dir, name);
  const templatesDir = join(skillDir, "templates");
  mkdirSync(skillDir, { recursive: true });
  mkdirSync(templatesDir, { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), `---\nname: ${name}\ndescription: "${description}"\n---\n`);
  writeFileSync(join(templatesDir, "example.md"), "# example\n");
};

beforeEach(() => mkdirSync(tmpBase, { recursive: true }));
afterEach(() => rmSync(tmpBase, { recursive: true, force: true }));

describe("createSkillsStorageService", () => {
  describe("listProjectSkills", () => {
    test("returns skills from the agent's project skills dir", () => {
      const repoRoot = join(tmpBase, "project-skills");
      mkdirSync(repoRoot, { recursive: true });

      writeSkill(join(repoRoot, ".claude", "skills"), "create-ticket", "Create a ticket");
      writeSkill(join(repoRoot, ".claude", "skills"), "review-ticket", "Review a ticket");

      const service = createSkillsStorageService();
      const skills = service.listProjectSkills(repoRoot, "claude-code");

      expect(skills).toHaveLength(2);
      expect(skills.map((s) => s.name).sort()).toEqual(["create-ticket", "review-ticket"]);
      expect(skills[0].description).toBeDefined();
      expect(skills[0]?.files.some((file) => file.path === "SKILL.md")).toBe(true);
      expect(skills[0]?.files.some((file) => file.path === "templates/example.md")).toBe(true);
    });

    test("returns empty array when skills dir does not exist", () => {
      const repoRoot = join(tmpBase, "no-skills-dir");
      mkdirSync(repoRoot, { recursive: true });

      const service = createSkillsStorageService();
      const skills = service.listProjectSkills(repoRoot, "claude-code");

      expect(skills).toEqual([]);
    });

    test("returns empty array for unknown agent", () => {
      const repoRoot = join(tmpBase, "unknown-agent");
      mkdirSync(repoRoot, { recursive: true });

      const service = createSkillsStorageService();
      const skills = service.listProjectSkills(repoRoot, "unknown-agent");

      expect(skills).toEqual([]);
    });
  });

  describe("listGlobalSkills", () => {
    test("returns skills from the global skills dir", () => {
      const homeDir = join(tmpBase, "home");
      writeSkill(join(homeDir, ".claude", "skills"), "create-ticket", "Create a ticket");

      const service = createSkillsStorageService({ homedir: homeDir });
      const skills = service.listGlobalSkills("claude-code");

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe("create-ticket");
      expect(skills[0]?.files).toHaveLength(2);
    });

    test("returns empty array when global skills dir does not exist", () => {
      const homeDir = join(tmpBase, "empty-home");
      mkdirSync(homeDir, { recursive: true });

      const service = createSkillsStorageService({ homedir: homeDir });
      const skills = service.listGlobalSkills("claude-code");

      expect(skills).toEqual([]);
    });
  });
});
