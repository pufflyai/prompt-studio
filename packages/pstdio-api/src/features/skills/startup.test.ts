import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { getBundledSkills } from "pstdio-agents";
import { createApp } from "../../app";
import type { AppBindings } from "../../types";
import type { SkillsRouteDeps } from "./deps";
import { ensureSkillsInstalled } from "./startup";

let app: OpenAPIHono<AppBindings>;
let deps: SkillsRouteDeps;
let tempRoot: string;
let repoPath: string;
let bundledSkills: Awaited<ReturnType<typeof getBundledSkills>>;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-skills-startup-test-"));
  repoPath = join(tempRoot, "repo");
  const result = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  });
  app = result.app;
  deps = result.deps;

  bundledSkills = await getBundledSkills();

  const projectRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Startup Skills Project" }),
  });
  const project = await projectRes.json();

  await app.request("/v1/agents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agent_id: "claude-code" }),
  });

  await app.request(`/v1/projects/${project.id}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "test-repo", path: repoPath }),
  });
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("ensureSkillsInstalled", () => {
  test("installs missing skills to agent directories", async () => {
    const skill = bundledSkills[0];
    const skillPath = join(repoPath, ".claude", "skills", skill.name, "SKILL.md");

    expect(existsSync(skillPath)).toBe(true);

    // Remove the skill to simulate it being missing
    rmSync(join(repoPath, ".claude", "skills", skill.name), { recursive: true, force: true });
    expect(existsSync(skillPath)).toBe(false);

    await ensureSkillsInstalled(deps);

    expect(existsSync(skillPath)).toBe(true);
    expect(readFileSync(skillPath, "utf8").length).toBeGreaterThan(0);
  });

  test("does not overwrite existing skills", async () => {
    const skill = bundledSkills[0];
    const skillPath = join(repoPath, ".claude", "skills", skill.name, "SKILL.md");

    // Write custom content to simulate a user-modified skill
    const customContent = "# custom user skill";
    rmSync(join(repoPath, ".claude", "skills", skill.name), { recursive: true, force: true });
    const { mkdirSync, writeFileSync } = await import("node:fs");
    mkdirSync(join(repoPath, ".claude", "skills", skill.name), { recursive: true });
    writeFileSync(skillPath, customContent, "utf8");

    await ensureSkillsInstalled(deps);

    // Should NOT overwrite
    expect(readFileSync(skillPath, "utf8")).toBe(customContent);
  });

  test("hydrates legacy file-based skills before installation", async () => {
    const legacyFilePath = join(tempRoot, "legacy-skill.md");
    writeFileSync(legacyFilePath, "# legacy skill", "utf8");

    const update = mock(async () => null);
    const depsMock = {
      projectService: { list: mock(async () => [{ id: "project-legacy" }]) },
      agentConfigService: { list: mock(async () => [{ agent_id: "claude-code" }]) },
      repoService: { listByProject: mock(async () => []) },
      skillService: {
        list: mock(async () => [
          {
            id: "skill-1",
            project_id: "project-legacy",
            name: "legacy-skill",
            description: "legacy",
            files: [],
            legacy_file_id: "file-legacy",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            deleted_at: null,
          },
        ]),
        update,
      },
      fileService: {
        get: mock(async () => ({ storage_path: legacyFilePath })),
      },
    } as unknown as SkillsRouteDeps;

    await ensureSkillsInstalled(depsMock);

    expect(update).toHaveBeenCalledWith("project-legacy", "legacy-skill", {
      files: [{ path: "SKILL.md", content: "# legacy skill", encoding: "utf8" }],
    });
  });

  test("hydrates legacy skills even when no agents are configured", async () => {
    const legacyFilePath = join(tempRoot, "legacy-skill-no-agents.md");
    writeFileSync(legacyFilePath, "# legacy no agents", "utf8");

    const update = mock(async () => null);
    const depsMock = {
      projectService: { list: mock(async () => [{ id: "project-legacy-no-agents" }]) },
      agentConfigService: { list: mock(async () => []) },
      repoService: { listByProject: mock(async () => []) },
      skillService: {
        list: mock(async () => [
          {
            id: "skill-2",
            project_id: "project-legacy-no-agents",
            name: "legacy-skill-no-agents",
            description: "legacy",
            files: [],
            legacy_file_id: "file-legacy-2",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            deleted_at: null,
          },
        ]),
        update,
      },
      fileService: {
        get: mock(async () => ({ storage_path: legacyFilePath })),
      },
    } as unknown as SkillsRouteDeps;

    await ensureSkillsInstalled(depsMock);

    expect(update).toHaveBeenCalledWith("project-legacy-no-agents", "legacy-skill-no-agents", {
      files: [{ path: "SKILL.md", content: "# legacy no agents", encoding: "utf8" }],
    });
  });

  test("skips local install for empty file trees", async () => {
    const repoPathWithEmptySkill = join(tempRoot, "repo-empty-skill");
    const depsMock = {
      projectService: { list: mock(async () => [{ id: "project-empty" }]) },
      agentConfigService: { list: mock(async () => [{ agent_id: "claude-code" }]) },
      repoService: { listByProject: mock(async () => [{ path: repoPathWithEmptySkill }]) },
      skillService: {
        list: mock(async () => [
          {
            id: "skill-empty",
            project_id: "project-empty",
            name: "empty-skill",
            description: "empty",
            files: [],
            legacy_file_id: null,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            deleted_at: null,
          },
        ]),
        update: mock(async () => null),
      },
      fileService: { get: mock(async () => null) },
    } as unknown as SkillsRouteDeps;

    await ensureSkillsInstalled(depsMock);
    expect(existsSync(join(repoPathWithEmptySkill, ".claude", "skills", "empty-skill"))).toBe(false);
  });
});

describe("ensureSkillsInstalled — syncs stale single-file skills with bundled tree", () => {
  test("syncs single-file skill to multi-file bundled when versions match", async () => {
    const bundledMulti = bundledSkills.find((s) => s.files.length > 1);
    if (!bundledMulti) throw new Error("Test fixture: no multi-file bundled skill available");

    const repoPathSync = join(tempRoot, "repo-sync");
    const skillDir = join(repoPathSync, ".claude", "skills", bundledMulti.name);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "stale", "utf8");

    const update = mock(async () => null);
    const depsMock = {
      projectService: { list: mock(async () => [{ id: "project-sync" }]) },
      agentConfigService: { list: mock(async () => [{ agent_id: "claude-code" }]) },
      repoService: { listByProject: mock(async () => [{ path: repoPathSync }]) },
      skillService: {
        list: mock(async () => [
          {
            id: "skill-sync",
            project_id: "project-sync",
            name: bundledMulti.name,
            description: bundledMulti.description,
            files: [
              {
                path: "SKILL.md",
                content: `---\nname: ${bundledMulti.name}\nmetadata:\n  - version: ${bundledMulti.version}\n---\n\n# stale single-file copy`,
                encoding: "utf8" as const,
              },
            ],
            legacy_file_id: null,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            deleted_at: null,
          },
        ]),
        update,
      },
      fileService: { get: mock(async () => null) },
    } as unknown as SkillsRouteDeps;

    await ensureSkillsInstalled(depsMock);

    expect(update).toHaveBeenCalledWith("project-sync", bundledMulti.name, { files: bundledMulti.files });
    for (const file of bundledMulti.files) {
      expect(existsSync(join(skillDir, file.path))).toBe(true);
    }
  });

  test("skips sync when stored skill version differs from bundled", async () => {
    const bundledMulti = bundledSkills.find((s) => s.files.length > 1);
    if (!bundledMulti) throw new Error("Test fixture: no multi-file bundled skill available");

    const update = mock(async () => null);
    const depsMock = {
      projectService: { list: mock(async () => [{ id: "project-skip-version" }]) },
      agentConfigService: { list: mock(async () => []) },
      repoService: { listByProject: mock(async () => []) },
      skillService: {
        list: mock(async () => [
          {
            id: "skill-skip-version",
            project_id: "project-skip-version",
            name: bundledMulti.name,
            description: "",
            files: [
              {
                path: "SKILL.md",
                content: `---\nname: ${bundledMulti.name}\nmetadata:\n  - version: 99.0.0\n---\n\n# user customized`,
                encoding: "utf8" as const,
              },
            ],
            legacy_file_id: null,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            deleted_at: null,
          },
        ]),
        update,
      },
      fileService: { get: mock(async () => null) },
    } as unknown as SkillsRouteDeps;

    await ensureSkillsInstalled(depsMock);
    expect(update).not.toHaveBeenCalled();
  });

  test("skips sync when stored skill already has all bundled files", async () => {
    const bundledMulti = bundledSkills.find((s) => s.files.length > 1);
    if (!bundledMulti) throw new Error("Test fixture: no multi-file bundled skill available");

    const update = mock(async () => null);
    const depsMock = {
      projectService: { list: mock(async () => [{ id: "project-already-synced" }]) },
      agentConfigService: { list: mock(async () => []) },
      repoService: { listByProject: mock(async () => []) },
      skillService: {
        list: mock(async () => [
          {
            id: "skill-already-synced",
            project_id: "project-already-synced",
            name: bundledMulti.name,
            description: bundledMulti.description,
            files: bundledMulti.files,
            legacy_file_id: null,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            deleted_at: null,
          },
        ]),
        update,
      },
      fileService: { get: mock(async () => null) },
    } as unknown as SkillsRouteDeps;

    await ensureSkillsInstalled(depsMock);
    expect(update).not.toHaveBeenCalled();
  });

  test("skips sync when no matching bundled skill exists", async () => {
    const update = mock(async () => null);
    const depsMock = {
      projectService: { list: mock(async () => [{ id: "project-custom" }]) },
      agentConfigService: { list: mock(async () => []) },
      repoService: { listByProject: mock(async () => []) },
      skillService: {
        list: mock(async () => [
          {
            id: "skill-custom",
            project_id: "project-custom",
            name: "custom-user-skill",
            description: "user owned",
            files: [
              {
                path: "SKILL.md",
                content: "---\nmetadata:\n  - version: 1.0.0\n---\n# custom",
                encoding: "utf8" as const,
              },
            ],
            legacy_file_id: null,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            deleted_at: null,
          },
        ]),
        update,
      },
      fileService: { get: mock(async () => null) },
    } as unknown as SkillsRouteDeps;

    await ensureSkillsInstalled(depsMock);
    expect(update).not.toHaveBeenCalled();
  });

  test("skips local install for empty file trees", async () => {
    const repoPathWithEmptySkill = join(tempRoot, "repo-empty-skill");
    const depsMock = {
      projectService: { list: mock(async () => [{ id: "project-empty" }]) },
      agentConfigService: { list: mock(async () => [{ agent_id: "claude-code" }]) },
      repoService: { listByProject: mock(async () => [{ path: repoPathWithEmptySkill }]) },
      skillService: {
        list: mock(async () => [
          {
            id: "skill-empty",
            project_id: "project-empty",
            name: "empty-skill",
            description: "empty",
            files: [],
            legacy_file_id: null,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            deleted_at: null,
          },
        ]),
        update: mock(async () => null),
      },
      fileService: {
        get: mock(async () => null),
      },
    } as unknown as SkillsRouteDeps;

    await ensureSkillsInstalled(depsMock);

    expect(existsSync(join(repoPathWithEmptySkill, ".claude", "skills", "empty-skill"))).toBe(false);
  });
});
