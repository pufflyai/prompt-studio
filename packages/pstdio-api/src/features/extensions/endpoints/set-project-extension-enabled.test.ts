import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createTestApp } from "../../../test-utils/create-test-app";
import { writeProvisionHarnessExtension } from "../../../test-utils/write-provision-harness-extension";
import type { AppBindings } from "../../../types";
import { createTestHarnessRecord, createTestHarnessRegistry } from "../../harnesses/test-harness-registry";
import { hashExtensionSource, loadExtensionSource } from "../extension-runtime";
import { createTestExtensionSource, createTestSkillExtensionSource } from "../test-utils/create-test-extension-source";

type AppHandle = Awaited<ReturnType<typeof createTestApp>>;

let app: OpenAPIHono<AppBindings>;
let handle: AppHandle;
let originalDefaultExtensions: string | undefined;
let originalPstdioHome: string | undefined;
let tempRoot: string;
let counter = 0;
// Mutable per-project disable map consulted by the test registry at call time.
const disabledByProject: Record<string, string[]> = {};

beforeAll(async () => {
  originalDefaultExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  originalPstdioHome = process.env.PSTDIO_HOME;
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-set-project-extension-enabled-test-"));
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  process.env.PSTDIO_HOME = join(tempRoot, "pstdio-home");
  handle = await createTestApp({
    databasePath: ":memory:",
    storageRoot: join(tempRoot, "storage"),
    harnessRegistry: createTestHarnessRegistry([createTestHarnessRecord("claude-code")], { disabledByProject }),
  });
  app = handle.app;
});

afterAll(async () => {
  await handle.close();
  if (originalDefaultExtensions === undefined) {
    delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  } else {
    process.env.PSTDIO_DEFAULT_EXTENSIONS = originalDefaultExtensions;
  }
  if (originalPstdioHome === undefined) {
    delete process.env.PSTDIO_HOME;
  } else {
    process.env.PSTDIO_HOME = originalPstdioHome;
  }
  rmSync(tempRoot, { recursive: true, force: true });
});

const createProject = async (name: string) => {
  const response = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return response.json();
};

const seedEnabledInstance = async (projectId: string) => {
  counter += 1;
  const installName = `toggle-source-${counter}`;
  const name = `test-toggle-${counter}`;
  const extensionId = `test.toggle-${counter}`;
  const displayName = `Toggle ${counter}`;
  const sourcePath = createTestExtensionSource({
    displayName,
    installName,
    name,
    root: tempRoot,
    version: "1.0.0",
  });

  const result = await handle.deps.extensionService.enableInstalledSourceForProject({
    displayName,
    extensionId,
    installName,
    manifest: { id: extensionId, name, displayName },
    name,
    projectId,
    sourcePath,
    version: "1.0.0",
  });

  return { instanceId: result.instance.id, installedExtensionId: result.installedSource.id };
};

const seedEnabledSkillInstance = async (projectId: string) => {
  counter += 1;
  const installName = `toggle-skill-source-${counter}`;
  const name = `test-toggle-skill-${counter}`;
  const sourcePath = createTestSkillExtensionSource({
    displayName: `Toggle Skill ${counter}`,
    installName,
    name,
    root: tempRoot,
    skillKey: "lab",
    version: "1.0.0",
  });
  const loaded = await loadExtensionSource(sourcePath);
  const result = await handle.deps.extensionService.enableInstalledSourceForProject({
    displayName: loaded.metadata.displayName,
    extensionId: loaded.metadata.id,
    installName,
    manifest: loaded.manifest,
    name: loaded.metadata.name,
    projectId,
    sourceHash: hashExtensionSource(sourcePath),
    sourcePath,
    version: loaded.metadata.version ?? null,
  });

  return { instanceId: result.instance.id };
};

// Enable a harness extension whose workspace.provision hook syncs skills into .claude/skills,
// so provisioning materializes (and prunes) the agent dir like the real harness extensions.
const enableProvisionHarness = async (projectId: string) => {
  const sourcePath = writeProvisionHarnessExtension(tempRoot, {
    installName: `provision-harness-${projectId}`,
    localId: "claude-code",
    skillsDir: ".claude/skills",
  });
  const loaded = await loadExtensionSource(sourcePath);
  await handle.deps.extensionService.enableInstalledSourceForProject({
    displayName: loaded.metadata.displayName,
    extensionId: loaded.metadata.id,
    installName: `provision-harness-${projectId}`,
    manifest: loaded.manifest,
    name: loaded.metadata.name,
    projectId,
    sourceHash: hashExtensionSource(sourcePath),
    sourcePath,
    version: loaded.metadata.version ?? null,
  });
};

const registerClaudeRepo = async (projectId: string, name: string) => {
  const repoPath = join(tempRoot, name);
  mkdirSync(repoPath, { recursive: true });
  const res = await app.request(`/v1/projects/${projectId}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, path: repoPath }),
  });
  expect(res.status).toBe(201);

  return repoPath;
};

describe("PATCH /v1/projects/:projectId/extensions/:instanceId", () => {
  test("flips enabled to false", async () => {
    const project = await createProject("Toggle Disable Project");
    const { instanceId } = await seedEnabledInstance(project.id);

    const res = await app.request(`/v1/projects/${project.id}/extensions/${instanceId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(false);
    expect(body.id).toBe(instanceId);

    const listRes = await app.request(`/v1/projects/${project.id}/extensions`);
    const list = await listRes.json();
    const row = list.extensions.find((entry: { id: string }) => entry.id === instanceId);
    expect(row?.enabled).toBe(false);
  });

  test("removes extension skills from configured agent repos when disabled", async () => {
    const project = await createProject("Toggle Skill Disable Project");
    await enableProvisionHarness(project.id);
    const { instanceId } = await seedEnabledSkillInstance(project.id);
    const repoPath = await registerClaudeRepo(project.id, "toggle-skill-disable-repo");
    const skillPath = join(repoPath, ".claude", "skills", "lab", "SKILL.md");
    expect(existsSync(skillPath)).toBe(true);

    const res = await app.request(`/v1/projects/${project.id}/extensions/${instanceId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });

    expect(res.status).toBe(200);
    // Disabling the skill extension drops its skill from the catalog; the next provision prunes it.
    expect(existsSync(skillPath)).toBe(false);
  });

  test("flips enabled back to true", async () => {
    const project = await createProject("Toggle Enable Project");
    const { instanceId } = await seedEnabledInstance(project.id);

    await app.request(`/v1/projects/${project.id}/extensions/${instanceId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });

    const res = await app.request(`/v1/projects/${project.id}/extensions/${instanceId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: true }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(true);
  });

  test("returns 404 when instance belongs to a different project", async () => {
    const projectA = await createProject("Toggle Owner Project");
    const projectB = await createProject("Toggle Stranger Project");
    const { instanceId } = await seedEnabledInstance(projectA.id);

    const res = await app.request(`/v1/projects/${projectB.id}/extensions/${instanceId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });

    expect(res.status).toBe(404);

    const listRes = await app.request(`/v1/projects/${projectA.id}/extensions`);
    const list = await listRes.json();
    const row = list.extensions.find((entry: { id: string }) => entry.id === instanceId);
    expect(row?.enabled).toBe(true);
  });

  test("returns 404 for unknown instance id", async () => {
    const project = await createProject("Toggle Missing Instance Project");

    const res = await app.request(`/v1/projects/${project.id}/extensions/${crypto.randomUUID()}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });

    expect(res.status).toBe(404);
  });
});
