import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createApp } from "../../../app";
import { writeProvisionHarnessExtension } from "../../../test-utils/write-provision-harness-extension";
import { hashExtensionSource, loadExtensionSource } from "../../extensions/extension-runtime";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

type AppHandle = Awaited<ReturnType<typeof createApp>>;

let handle: AppHandle;
let tempRoot: string;
let projectId: string;
let sourcePath: string;

const catalogSkillPath = () => join(sourcePath, "skills", "catalog-skill", "SKILL.md");
const versionedSkillContent = (version: string) => `---
metadata:
  version: ${version}
---

# Catalog Skill
`;

const writeSkillExtension = (root: string) => {
  const sourcePath = join(root, "skill-extension");
  const skillRoot = join(sourcePath, "skills", "catalog-skill");
  mkdirSync(join(skillRoot, "references"), { recursive: true });
  writeFileSync(
    join(sourcePath, "package.json"),
    JSON.stringify({
      name: "test-skill-catalog",
      version: "1.0.0",
      displayName: "Test Skill Catalog",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
    }),
  );
  writeFileSync(join(skillRoot, "SKILL.md"), "# Catalog Skill\n", "utf8");
  writeFileSync(join(skillRoot, "references", "notes.md"), "# Notes\n", "utf8");
  writeFileSync(
    join(sourcePath, "extension.ts"),
    `const asset = (path: string) => ({ kind: "package-asset" as const, path, baseUrl: import.meta.url });

export default {
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

const enableSource = async (sourcePath: string, installName: string) => {
  const loaded = await loadExtensionSource(sourcePath);
  await handle.deps.extensionService.enableInstalledSourceForProject({
    projectId,
    installName,
    displayName: loaded.metadata.displayName,
    extensionId: loaded.metadata.id,
    manifest: loaded.manifest,
    name: loaded.metadata.name,
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
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("claude-code"),
      createTestHarnessRecord("codex"),
    ]),
  });

  const res = await handle.app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Test Project" }),
  });
  const project = await res.json();
  projectId = project.id;
  sourcePath = writeSkillExtension(tempRoot);
  await enableSource(sourcePath, "skill-extension");

  // Enable harness extensions whose workspace.provision hooks sync skills into each agent dir,
  // so install-status assertions observe the provisioned files.
  const claudeHarnessPath = writeProvisionHarnessExtension(tempRoot, {
    installName: "provision-harness-claude",
    localId: "claude-code",
    skillsDir: ".claude/skills",
  });
  await enableSource(claudeHarnessPath, "provision-harness-claude");

  const codexHarnessPath = writeProvisionHarnessExtension(tempRoot, {
    installName: "provision-harness-codex",
    localId: "codex",
    skillsDir: ".agents/skills",
  });
  await enableSource(codexHarnessPath, "provision-harness-codex");
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
    expect(body.outdated_agents).toEqual([]);
    expect(body.agent_installations).toEqual([]);
  });

  test("returns 404 for missing skill", async () => {
    const res = await handle.app.request(`/v1/projects/${projectId}/skills/nonexistent`);
    expect(res.status).toBe(404);
  });

  test("returns agent IDs where the skill is installed locally", async () => {
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
    expect(body.installed_agents).toContain(testHarnessId("claude-code"));
  });

  test("returns agent IDs where the installed skill is out of date", async () => {
    writeFileSync(catalogSkillPath(), versionedSkillContent("1.2.0"), "utf8");
    const repoPath = join(tempRoot, "repo-outdated-agents");
    mkdirSync(repoPath, { recursive: true });
    const repoRes = await handle.app.request(`/v1/projects/${projectId}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "outdated-agents-repo", path: repoPath }),
    });
    expect(repoRes.status).toBe(201);

    try {
      writeFileSync(catalogSkillPath(), versionedSkillContent("1.3.0"), "utf8");

      const res = await handle.app.request(`/v1/projects/${projectId}/skills/catalog-skill`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.installed_agents).toContain(testHarnessId("claude-code"));
      expect(body.outdated_agents).toContain(testHarnessId("claude-code"));
      expect(body.agent_installations).toContainEqual(
        expect.objectContaining({
          agent_id: testHarnessId("claude-code"),
          agent_name: "claude-code",
          installed_version: "1.2.0",
          outdated: true,
        }),
      );
      expect(body.agent_installations).toContainEqual(
        expect.objectContaining({
          agent_id: testHarnessId("codex"),
          agent_name: "codex",
          installed_version: "1.2.0",
          outdated: true,
        }),
      );
    } finally {
      writeFileSync(catalogSkillPath(), "# Catalog Skill\n", "utf8");
    }
  });
});

describe("POST /v1/projects/:id/skills/:name/update", () => {
  test("updates installed extension-backed skills to the latest source files", async () => {
    writeFileSync(catalogSkillPath(), "# Catalog Skill\n", "utf8");
    const repoPath = join(tempRoot, "repo-update-skill");
    mkdirSync(repoPath, { recursive: true });
    const repoRes = await handle.app.request(`/v1/projects/${projectId}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "update-skill-repo", path: repoPath }),
    });
    expect(repoRes.status).toBe(201);

    try {
      writeFileSync(catalogSkillPath(), "# Catalog Skill v2\n", "utf8");

      const res = await handle.app.request(`/v1/projects/${projectId}/skills/catalog-skill/update`, {
        method: "POST",
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.outdated_agents).not.toContain(testHarnessId("claude-code"));
      expect(readFileSync(join(repoPath, ".claude", "skills", "catalog-skill", "SKILL.md"), "utf8")).toBe(
        "# Catalog Skill v2\n",
      );
    } finally {
      writeFileSync(catalogSkillPath(), "# Catalog Skill\n", "utf8");
    }
  });
});
