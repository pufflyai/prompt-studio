import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import { resolveTestFilesRoot } from "../../../test-utils/resolve-test-files-root";
import type { AppBindings } from "../../../types";
import { hashExtensionSource, loadExtensionSource } from "../extension-runtime";
import { createTestExtensionSource, createTestSkillExtensionSource } from "../test-utils/create-test-extension-source";

type AppHandle = Awaited<ReturnType<typeof createApp>>;

let app: OpenAPIHono<AppBindings>;
let handle: AppHandle;
let originalDefaultExtensions: string | undefined;
let originalPstdioHome: string | undefined;
let pstdioHome: string;
let tempRoot: string;

beforeAll(async () => {
  originalDefaultExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  originalPstdioHome = process.env.PSTDIO_HOME;
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-list-project-extensions-test-"));
  pstdioHome = join(tempRoot, "pstdio-home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  process.env.PSTDIO_HOME = pstdioHome;
  handle = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: resolveTestFilesRoot(),
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

const seedInstance = async (
  projectId: string,
  fields: {
    name: string;
    extensionId: string;
    displayName: string;
    installName: string;
    enabled?: boolean;
    version?: string | null;
  },
) => {
  const sourcePath = createTestExtensionSource({ ...fields, root: tempRoot });
  const installedSource = await handle.deps.extensionService.registerInstalledSource({
    displayName: fields.displayName,
    extensionId: fields.extensionId,
    installName: fields.installName,
    manifest: { id: fields.extensionId, name: fields.name, displayName: fields.displayName },
    name: fields.name,
    sourcePath,
    version: fields.version ?? null,
  });

  const result = await handle.deps.extensionService.enableInstalledSourceForProject({
    displayName: fields.displayName,
    extensionId: fields.extensionId,
    installName: fields.installName,
    manifest: { id: fields.extensionId, name: fields.name, displayName: fields.displayName },
    name: fields.name,
    projectId,
    sourcePath: installedSource.source_path,
    version: fields.version ?? null,
  });

  if (fields.enabled === false) {
    await handle.deps.extensionService.setProjectExtensionEnabled(result.instance.id, false);
  }

  return { instanceId: result.instance.id, installedExtensionId: result.installedSource.id };
};

const seedSkillInstance = async (projectId: string, installName: string) => {
  const sourcePath = createTestSkillExtensionSource({
    displayName: "Deleted Skill Extension",
    installName,
    name: "deleted-skill-extension",
    root: pstdioHome,
    skillKey: "lab",
    version: "1.0.0",
  });
  const loaded = await loadExtensionSource(sourcePath);
  await handle.deps.extensionService.enableInstalledSourceForProject({
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

  return sourcePath;
};

const registerClaudeRepo = async (projectId: string, name: string) => {
  await app.request("/v1/agents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agent_id: "claude-code" }),
  });

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

describe("GET /v1/projects/:projectId/extensions", () => {
  test("lists both enabled and disabled instances with source metadata", async () => {
    const project = await createProject("Extensions List Project");

    const enabled = await seedInstance(project.id, {
      name: "list-enabled",
      extensionId: "test.list-enabled",
      displayName: "List Enabled",
      installName: "list-enabled-source",
      version: "1.2.3",
    });

    const disabled = await seedInstance(project.id, {
      name: "list-disabled",
      extensionId: "test.list-disabled",
      displayName: "List Disabled",
      installName: "list-disabled-source",
      enabled: false,
    });

    const res = await app.request(`/v1/projects/${project.id}/extensions`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.extensions)).toBe(true);

    const byId = new Map<string, (typeof body.extensions)[number]>(
      body.extensions.map((entry: { id: string }) => [entry.id, entry]),
    );

    const enabledRow = byId.get(enabled.instanceId);
    expect(enabledRow).toBeDefined();
    expect(enabledRow?.enabled).toBe(true);
    expect(enabledRow?.name).toBe("list-enabled");
    expect(enabledRow?.displayName).toBe("List Enabled");
    expect(enabledRow?.installName).toBe("list-enabled-source");
    expect(enabledRow?.installedExtensionId).toBe(enabled.installedExtensionId);
    expect(enabledRow?.extensionId).toBe("test.list-enabled");
    expect(enabledRow?.version).toBe("1.2.3");
    expect(enabledRow?.sourcePath).toContain("list-enabled-source");
    expect(enabledRow?.projectId).toBe(project.id);

    const disabledRow = byId.get(disabled.instanceId);
    expect(disabledRow).toBeDefined();
    expect(disabledRow?.enabled).toBe(false);
    expect(disabledRow?.name).toBe("list-disabled");
    expect(disabledRow).not.toHaveProperty("namespace");
  });

  test("lists discovered installed sources as disabled project extensions", async () => {
    const project = await createProject("Discovered Extension Project");
    const sourcePath = createTestExtensionSource({
      root: tempRoot,
      name: "discovered-extension",
      displayName: "Discovered Extension",
      installName: "discovered-extension-source",
    });

    const synced = await handle.deps.extensionService.syncInstalledSourceForProject({
      displayName: "Discovered Extension",
      extensionId: "test.discovered-extension",
      installName: "discovered-extension-source",
      manifest: {
        displayName: "Discovered Extension",
        id: "test.discovered-extension",
        name: "discovered-extension",
      },
      name: "discovered-extension",
      projectId: project.id,
      sourcePath,
    });

    const res = await app.request(`/v1/projects/${project.id}/extensions`);
    expect(res.status).toBe(200);

    const body = await res.json();
    const row = body.extensions.find((entry: { id: string }) => entry.id === synced.instance.id);

    expect(row).toMatchObject({
      displayName: "Discovered Extension",
      enabled: false,
      installName: "discovered-extension-source",
      name: "discovered-extension",
      projectId: project.id,
    });
  });

  test("syncs globally installed extensions when a project extension list is requested", async () => {
    const project = await createProject("Late Discovery Extension Project");
    createTestExtensionSource({
      root: pstdioHome,
      name: "late-discovered-extension",
      displayName: "Late Discovered Extension",
      installName: "late-discovered-extension-source",
    });

    const res = await app.request(`/v1/projects/${project.id}/extensions`);
    expect(res.status).toBe(200);

    const body = await res.json();
    const row = body.extensions.find(
      (entry: { installName: string }) => entry.installName === "late-discovered-extension-source",
    );

    expect(row).toMatchObject({
      displayName: "Late Discovered Extension",
      enabled: false,
      installName: "late-discovered-extension-source",
      name: "late-discovered-extension",
      projectId: project.id,
    });
  });

  test("removes extensions whose installed folder was deleted", async () => {
    const project = await createProject("Deleted Extension Project");
    const sourcePath = createTestExtensionSource({
      root: pstdioHome,
      name: "deleted-extension",
      displayName: "Deleted Extension",
      installName: "deleted-extension-source",
    });

    const firstRes = await app.request(`/v1/projects/${project.id}/extensions`);
    expect(firstRes.status).toBe(200);

    const firstBody = await firstRes.json();
    expect(
      firstBody.extensions.find((entry: { installName: string }) => entry.installName === "deleted-extension-source"),
    ).toBeDefined();

    rmSync(sourcePath, { recursive: true, force: true });

    const secondRes = await app.request(`/v1/projects/${project.id}/extensions`);
    expect(secondRes.status).toBe(200);

    const secondBody = await secondRes.json();
    expect(
      secondBody.extensions.find((entry: { installName: string }) => entry.installName === "deleted-extension-source"),
    ).toBeUndefined();
  });

  test("removes installed skills when an extension folder was deleted", async () => {
    const project = await createProject("Deleted Extension Skill Project");
    const sourcePath = await seedSkillInstance(project.id, "deleted-skill-extension-source");
    const repoPath = await registerClaudeRepo(project.id, "deleted-extension-skill-repo");
    const skillPath = join(repoPath, ".claude", "skills", "lab", "SKILL.md");
    expect(existsSync(skillPath)).toBe(true);

    rmSync(sourcePath, { recursive: true, force: true });

    const res = await app.request(`/v1/projects/${project.id}/extensions`);
    expect(res.status).toBe(200);
    expect(existsSync(skillPath)).toBe(false);
  });

  test("returns 404 when project does not exist", async () => {
    const res = await app.request("/v1/projects/missing-project/extensions");
    expect(res.status).toBe(404);
  });
});
