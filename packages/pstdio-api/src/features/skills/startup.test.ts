import { describe, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Skill } from "pstdio-api-contracts";
import type { SkillsRouteDeps } from "./deps";
import { ensureSkillsInstalled } from "./startup";

const createSkill = (name: string, files = [{ path: "SKILL.md", content: "# Skill", encoding: "utf8" as const }]) =>
  ({
    id: `skill-${name}`,
    project_id: "project-1",
    name,
    title: name,
    description: "",
    source_kind: "extension",
    files,
    editable: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
  }) satisfies Skill;

const createDeps = (repoPath: string, skills: Skill[]) =>
  ({
    projectService: { list: mock(async () => [{ id: "project-1" }]) },
    agentConfigService: { list: mock(async () => [{ agent_id: "claude-code" }]) },
    repoService: { listByProject: mock(async () => [{ path: repoPath }]) },
    skillService: { list: mock(async () => skills) },
  }) as unknown as SkillsRouteDeps;

describe("ensureSkillsInstalled", () => {
  test("installs missing skills to agent directories", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-skills-startup-install-"));
    const repoPath = join(root, "repo");
    const skill = createSkill("catalog-skill", [
      { path: "SKILL.md", content: "# Catalog Skill", encoding: "utf8" },
      { path: "references/notes.md", content: "# Notes", encoding: "utf8" },
    ]);

    try {
      await ensureSkillsInstalled(createDeps(repoPath, [skill]));

      const skillPath = join(repoPath, ".claude", "skills", "catalog-skill", "SKILL.md");
      expect(existsSync(skillPath)).toBe(true);
      expect(readFileSync(skillPath, "utf8")).toBe("# Catalog Skill");
      expect(existsSync(join(repoPath, ".claude", "skills", "catalog-skill", "references", "notes.md"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("does not overwrite existing skills", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-skills-startup-existing-"));
    const repoPath = join(root, "repo");
    const skillPath = join(repoPath, ".claude", "skills", "catalog-skill", "SKILL.md");
    mkdirSync(join(repoPath, ".claude", "skills", "catalog-skill"), { recursive: true });
    writeFileSync(skillPath, "# custom user skill", "utf8");

    try {
      await ensureSkillsInstalled(createDeps(repoPath, [createSkill("catalog-skill")]));

      expect(readFileSync(skillPath, "utf8")).toBe("# custom user skill");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("skips local install for empty file trees", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-skills-startup-empty-"));
    const repoPath = join(root, "repo");

    try {
      await ensureSkillsInstalled(createDeps(repoPath, [createSkill("empty-skill", [])]));

      expect(existsSync(join(repoPath, ".claude", "skills", "empty-skill"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
