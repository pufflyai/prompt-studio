import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import type { createExtensionService } from "../../services/extension-service";
import { createTestApp } from "../../test-utils/create-test-app";
import { writeProvisionHarnessExtension } from "../../test-utils/write-provision-harness-extension";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";
import { hashExtensionSource, loadExtensionSource } from "./extension-runtime";

type AppHandle = Awaited<ReturnType<typeof createTestApp>>;

const CLAUDE_CODE_ID = testHarnessId("claude-code");

const writeCatalogExtension = (root: string, options?: { escapeTemplate?: boolean }) => {
  const sourcePath = join(root, "catalog-extension");
  mkdirSync(join(sourcePath, "templates"), { recursive: true });
  mkdirSync(join(sourcePath, "skills", "lab-skill", "notes"), { recursive: true });
  writeFileSync(
    join(sourcePath, "package.json"),
    JSON.stringify({
      name: "test-catalog",
      version: "0.1.0",
      displayName: "Test Catalog",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
    }),
  );
  writeFileSync(join(sourcePath, "templates", "lab-ticket.md"), "# Lab Ticket\n", "utf8");
  writeFileSync(join(sourcePath, "skills", "lab-skill", "SKILL.md"), "# Lab Skill\n", "utf8");
  writeFileSync(join(sourcePath, "skills", "lab-skill", "notes", "example.md"), "example\n", "utf8");
  writeFileSync(join(root, "outside.md"), "# Outside\n", "utf8");
  writeFileSync(
    join(sourcePath, "extension.ts"),
    `const asset = (path: string) => ({ kind: "package-asset" as const, path, baseUrl: import.meta.url });

export default {
  templates: [
    {
      id: "catalogTicket",
      ref: { kind: "template", id: "catalogTicket" },
      title: "Catalog Ticket",
      type: "ticket",
      source: asset(${JSON.stringify(options?.escapeTemplate ? "../outside.md" : "./templates/lab-ticket.md")}),
    },
  ],
  skills: [
    {
      id: "catalogSkill",
      ref: { kind: "skill", id: "catalogSkill" },
      title: "Catalog Skill",
      description: "Skill from an extension directory.",
      source: asset("./skills/lab-skill"),
    },
  ],
};
`,
    "utf8",
  );
  return sourcePath;
};

const enableSource = async (
  extensionService: ReturnType<typeof createExtensionService>,
  projectId: string,
  sourcePath: string,
  installName: string,
) => {
  const loaded = await loadExtensionSource(sourcePath);
  return extensionService.enableInstalledSourceForProject({
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

// Enable a harness extension whose workspace.provision hook syncs skills into .claude/skills.
const enableProvisionHarness = (
  extensionService: ReturnType<typeof createExtensionService>,
  projectId: string,
  root: string,
) =>
  enableSource(
    extensionService,
    projectId,
    writeProvisionHarnessExtension(root, {
      installName: `provision-harness-${projectId}`,
      localId: "claude-code",
      skillsDir: ".claude/skills",
    }),
    `provision-harness-${projectId}`,
  );

const createProject = async (handle: AppHandle, name: string) => {
  const res = await handle.app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  expect(res.status).toBe(201);
  return res.json() as Promise<{ id: string }>;
};

let handle: AppHandle;
let tempRoot: string;

beforeEach(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-extension-catalog-test-"));
  handle = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([createTestHarnessRecord("claude-code", { availability: "INSTALLED" })]),
    databasePath: ":memory:",
    storageRoot: join(tempRoot, "storage"),
  });
});

afterEach(async () => {
  await handle.close();
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("extension-backed skill catalog", () => {
  test("lists extension-backed skills and installs directory skills into registered repos", async () => {
    const project = await createProject(handle, "Skill Catalog Project");
    const sourcePath = writeCatalogExtension(tempRoot);
    await enableSource(handle.deps.extensionService, project.id, sourcePath, "catalog");
    await enableProvisionHarness(handle.deps.extensionService, project.id, tempRoot);

    const listRes = await handle.app.request(`/v1/projects/${project.id}/skills`);
    expect(listRes.status).toBe(200);
    const skills = await listRes.json();
    expect(skills.find((skill: { name: string }) => skill.name === "catalog-skill")).toMatchObject({
      source_kind: "extension",
      extension_id: "pstdio.test-catalog",
      key: "catalogSkill",
      title: "Catalog Skill",
      enabled: true,
    });

    const getRes = await handle.app.request(`/v1/projects/${project.id}/skills/catalog-skill`);
    expect(getRes.status).toBe(200);
    const skill = await getRes.json();
    expect(skill.files.map((file: { path: string }) => file.path).sort()).toEqual(["SKILL.md", "notes/example.md"]);

    const disableRes = await handle.app.request(`/v1/projects/${project.id}/skills/catalog-skill`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
    expect(disableRes.status).toBe(200);

    const disabledListRes = await handle.app.request(`/v1/projects/${project.id}/skills`);
    const disabledSkills = await disabledListRes.json();
    expect(disabledSkills.some((entry: { name: string }) => entry.name === "catalog-skill")).toBe(false);

    const enableRes = await handle.app.request(`/v1/projects/${project.id}/skills/catalog-skill`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: true }),
    });
    expect(enableRes.status).toBe(200);

    await handle.app.request("/v1/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_id: CLAUDE_CODE_ID }),
    });

    const repoPath = join(tempRoot, "repo");
    mkdirSync(repoPath, { recursive: true });
    const repoRes = await handle.app.request(`/v1/projects/${project.id}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "repo", path: repoPath }),
    });
    expect(repoRes.status).toBe(201);
    expect(readFileSync(join(repoPath, ".claude", "skills", "catalog-skill", "SKILL.md"), "utf8")).toBe(
      "# Lab Skill\n",
    );
    expect(existsSync(join(repoPath, ".claude", "skills", "catalog-skill", "notes", "example.md"))).toBe(true);
  });

  test("installs extension catalog skills to repos for available harnesses", async () => {
    await handle.close();
    handle = await createTestApp({
      harnessRegistry: createTestHarnessRegistry([createTestHarnessRecord("claude-code")]),
      databasePath: ":memory:",
      storageRoot: join(tempRoot, "isolated-storage"),
    });

    const project = await createProject(handle, "Agent Setup Project");
    const sourcePath = writeCatalogExtension(tempRoot);
    await enableSource(handle.deps.extensionService, project.id, sourcePath, "catalog");
    await enableProvisionHarness(handle.deps.extensionService, project.id, tempRoot);

    const repoPath = join(tempRoot, "late-agent-repo");
    mkdirSync(repoPath, { recursive: true });
    const repoRes = await handle.app.request(`/v1/projects/${project.id}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "late-agent-repo", path: repoPath }),
    });
    expect(repoRes.status).toBe(201);
    expect(readFileSync(join(repoPath, ".claude", "skills", "catalog-skill", "SKILL.md"), "utf8")).toBe(
      "# Lab Skill\n",
    );
  });
});
