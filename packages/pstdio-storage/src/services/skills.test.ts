import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createSkillsService } from "./skills";

const tmpBase = join(import.meta.dirname, "__test-skills-tmp__");

const writeSkill = (dir: string, name: string, description: string) => {
  const skillDir = join(dir, name);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), `---\nname: ${name}\ndescription: "${description}"\n---\n`);
};

const fakeReposService = (repoPath: string) =>
  ({
    listByProject: async () => [{ path: repoPath }],
  }) as unknown as Parameters<typeof createSkillsService>[0];

beforeEach(() => mkdirSync(tmpBase, { recursive: true }));
afterEach(() => rmSync(tmpBase, { recursive: true, force: true }));

describe("createSkillsService", () => {
  describe("listProjectSkills", () => {
    test("returns skills from the agent's project skills dir", async () => {
      const repoRoot = join(tmpBase, "project-skills");
      mkdirSync(repoRoot, { recursive: true });

      writeSkill(join(repoRoot, ".claude", "skills"), "create-ticket", "Create a ticket");
      writeSkill(join(repoRoot, ".claude", "skills"), "review-ticket", "Review a ticket");

      const service = createSkillsService(fakeReposService(repoRoot));
      const skills = await service.listProjectSkills("proj-1", "claude-code");

      expect(skills).toHaveLength(2);
      expect(skills.map((s) => s.name).sort()).toEqual(["create-ticket", "review-ticket"]);
      expect(skills[0].description).toBeDefined();
    });

    test("returns empty array when skills dir does not exist", async () => {
      const repoRoot = join(tmpBase, "no-skills-dir");
      mkdirSync(repoRoot, { recursive: true });

      const service = createSkillsService(fakeReposService(repoRoot));
      const skills = await service.listProjectSkills("proj-1", "claude-code");

      expect(skills).toEqual([]);
    });

    test("returns empty array for unknown agent", async () => {
      const repoRoot = join(tmpBase, "unknown-agent");
      mkdirSync(repoRoot, { recursive: true });

      const service = createSkillsService(fakeReposService(repoRoot));
      const skills = await service.listProjectSkills("proj-1", "unknown-agent");

      expect(skills).toEqual([]);
    });

    test("returns empty array when project has no repos", async () => {
      const emptyRepos = { listByProject: async () => [] } as unknown as Parameters<typeof createSkillsService>[0];
      const service = createSkillsService(emptyRepos);
      const skills = await service.listProjectSkills("proj-1", "claude-code");

      expect(skills).toEqual([]);
    });
  });

  describe("listGlobalSkills", () => {
    test("returns skills from the global skills dir", async () => {
      const homeDir = join(tmpBase, "home");
      writeSkill(join(homeDir, ".claude", "skills"), "create-ticket", "Create a ticket");

      const service = createSkillsService(fakeReposService(""), { homedir: homeDir });
      const skills = await service.listGlobalSkills("claude-code");

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe("create-ticket");
    });

    test("returns empty array when global skills dir does not exist", async () => {
      const homeDir = join(tmpBase, "empty-home");
      mkdirSync(homeDir, { recursive: true });

      const service = createSkillsService(fakeReposService(""), { homedir: homeDir });
      const skills = await service.listGlobalSkills("claude-code");

      expect(skills).toEqual([]);
    });
  });
});
