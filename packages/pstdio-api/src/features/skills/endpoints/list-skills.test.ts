import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../../app";
import { hashExtensionSource, loadExtensionSource } from "../../extensions/extension-runtime";

type AppHandle = Awaited<ReturnType<typeof createApp>>;

let handle: AppHandle;
let tempRoot: string;
let projectId: string;

const writeSkillExtension = (root: string) => {
  const sourcePath = join(root, "skill-extension");
  const skillRoot = join(sourcePath, "skills", "catalog-skill");
  mkdirSync(join(skillRoot, "references"), { recursive: true });
  writeFileSync(join(skillRoot, "SKILL.md"), "# Catalog Skill\n", "utf8");
  writeFileSync(join(skillRoot, "references", "notes.md"), "# Notes\n", "utf8");
  writeFileSync(
    join(sourcePath, "extension.ts"),
    `const asset = (path: string) => ({ kind: "package-asset" as const, path, baseUrl: import.meta.url });

export default {
  id: "pstdio.test-skill-catalog",
  namespace: "test-skill-catalog",
  name: "Test Skill Catalog",
  apiVersion: "1",
  skills: {
    catalogSkill: {
      title: "Catalog Skill",
      description: "Skill from an extension.",
      source: asset("./skills/catalog-skill"),
    },
  },
};
`,
    "utf8",
  );
  return sourcePath;
};

const enableSource = async (sourcePath: string) => {
  const loaded = await loadExtensionSource(sourcePath);
  await handle.deps.extensionService.enableInstalledSourceForProject({
    projectId,
    installName: "skill-extension",
    displayName: loaded.metadata.name,
    extensionId: loaded.metadata.id,
    manifest: loaded.manifest,
    namespace: loaded.metadata.namespace,
    sourceHash: hashExtensionSource(sourcePath),
    sourcePath,
    version: loaded.metadata.version ?? null,
  });
};

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-skills-test-"));
  handle = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  });

  const res = await handle.app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Test Project" }),
  });
  const project = await res.json();
  projectId = project.id;
  await enableSource(writeSkillExtension(tempRoot));
});

afterAll(async () => {
  await handle.close();
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("GET /v1/projects/:id/skills", () => {
  test("lists extension-backed skills for a project", async () => {
    const res = await handle.app.request(`/v1/projects/${projectId}/skills`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toContainEqual(
      expect.objectContaining({
        name: "catalog-skill",
        source_kind: "extension",
        title: "Catalog Skill",
      }),
    );
  });
});

describe("GET /v1/projects/:id/skills/:name", () => {
  test("returns skill metadata and content fields", async () => {
    const res = await handle.app.request(`/v1/projects/${projectId}/skills/catalog-skill`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.name).toBe("catalog-skill");
    expect(body).not.toHaveProperty("bundled_version");
    expect(body.files.map((file: { path: string }) => file.path).sort()).toEqual(["SKILL.md", "references/notes.md"]);
    expect(body.installed_agents).toEqual([]);
  });

  test("returns 404 for missing skill", async () => {
    const res = await handle.app.request(`/v1/projects/${projectId}/skills/nonexistent`);
    expect(res.status).toBe(404);
  });

  test("returns agent IDs where the skill is installed locally", async () => {
    await handle.app.request("/v1/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_id: "claude-code" }),
    });

    const repoPath = join(tempRoot, "repo-installed-agents");
    mkdirSync(repoPath, { recursive: true });
    const repoRes = await handle.app.request(`/v1/projects/${projectId}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "installed-agents-repo", path: repoPath }),
    });
    expect(repoRes.status).toBe(201);

    const res = await handle.app.request(`/v1/projects/${projectId}/skills/catalog-skill`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.installed_agents).toContain("claude-code");
  });
});
