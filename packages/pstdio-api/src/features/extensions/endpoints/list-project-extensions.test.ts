import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../../test-utils/create-test-app";
import type { AppBindings } from "../../../types";
import { createTestHarnessRecord, createTestHarnessRegistry } from "../../harnesses/test-harness-registry";
import { createTestExtensionSource } from "../test-utils/create-test-extension-source";

type AppHandle = Awaited<ReturnType<typeof createTestApp>>;

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
  handle = await createTestApp({
    databasePath: ":memory:",
    storageRoot: join(tempRoot, "storage"),
    harnessRegistry: createTestHarnessRegistry([createTestHarnessRecord("claude-code")]),
    release: { source: "git", ref: "pstdio@0.27.0" },
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
    enginesPstdio?: string;
    sourceKind?: "git" | "local_path";
    version?: string | null;
  },
) => {
  const sourcePath = createTestExtensionSource({ ...fields, root: tempRoot });
  const installedSource = await handle.deps.extensionService.registerInstalledSource({
    displayName: fields.displayName,
    extensionId: fields.extensionId,
    installName: fields.installName,
    manifest: {
      id: fields.extensionId,
      name: fields.name,
      displayName: fields.displayName,
      ...(fields.enginesPstdio ? { enginesPstdio: fields.enginesPstdio } : {}),
    },
    name: fields.name,
    sourcePath,
    sourceKind: fields.sourceKind,
    version: fields.version ?? null,
  });

  const result = await handle.deps.extensionService.enableInstalledSourceForProject({
    displayName: fields.displayName,
    extensionId: fields.extensionId,
    installName: fields.installName,
    manifest: {
      id: fields.extensionId,
      name: fields.name,
      displayName: fields.displayName,
      ...(fields.enginesPstdio ? { enginesPstdio: fields.enginesPstdio } : {}),
    },
    name: fields.name,
    projectId,
    sourcePath: installedSource.source_path,
    sourceKind: fields.sourceKind,
    version: fields.version ?? null,
  });

  if (fields.enabled === false) {
    await handle.deps.extensionService.setProjectExtensionEnabled(result.instance.id, false);
  }

  return { instanceId: result.instance.id, installedExtensionId: result.installedSource.id };
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

  test("reports an incompatible adopted extension as an error", async () => {
    const project = await createProject("Incompatible Extension Project");
    const seeded = await seedInstance(project.id, {
      name: "incompatible-extension",
      extensionId: "test.incompatible-extension",
      displayName: "Incompatible Extension",
      installName: "incompatible-extension-source",
      enginesPstdio: "1.0.0-alpha.1",
      sourceKind: "git",
    });

    const res = await app.request(`/v1/projects/${project.id}/extensions`);
    expect(res.status).toBe(200);

    const body = await res.json();
    const row = body.extensions.find((entry: { id: string }) => entry.id === seeded.instanceId);

    expect(row).toMatchObject({
      canUpgrade: false,
      status: "error",
      lastError: { code: "extension_manifest_unsupported_api_version" },
    });
  });

  test("keeps a healthy local-first core extension under local source control", async () => {
    const project = await createProject("Local Core Extension Project");
    const seeded = await seedInstance(project.id, {
      name: "pstdio-planner",
      extensionId: "pstdio.pstdio-planner",
      displayName: "Prompt Studio Planner",
      installName: "pstdio-planner",
      enginesPstdio: EXTENSION_API_VERSION,
      sourceKind: "local_path",
      version: "0.10.0",
    });

    const res = await app.request(`/v1/projects/${project.id}/extensions`);
    expect(res.status).toBe(200);

    const body = await res.json();
    const row = body.extensions.find((entry: { id: string }) => entry.id === seeded.instanceId);

    expect(row).toMatchObject({
      canUpgrade: false,
      installName: "pstdio-planner",
      status: "loaded",
      version: "0.10.0",
    });
  });

  test("offers release recovery for an incompatible core extension without install provenance", async () => {
    const project = await createProject("Incompatible Core Extension Project");
    const seeded = await seedInstance(project.id, {
      name: "pstdio-skills",
      extensionId: "pstdio.pstdio-skills",
      displayName: "Prompt Studio Skills",
      installName: "pstdio-skills",
      enginesPstdio: "1.0.0-alpha.1",
      sourceKind: "local_path",
      version: "0.3.0",
    });

    const res = await app.request(`/v1/projects/${project.id}/extensions`);
    expect(res.status).toBe(200);

    const body = await res.json();
    const row = body.extensions.find((entry: { id: string }) => entry.id === seeded.instanceId);

    expect(row).toMatchObject({
      canUpgrade: true,
      installName: "pstdio-skills",
      status: "error",
      lastError: { code: "extension_manifest_unsupported_api_version" },
      version: "0.3.0",
    });
  });

  test("lists uninstalled core extensions in the marketplace", async () => {
    const project = await createProject("Extension Marketplace Project");

    const res = await app.request(`/v1/projects/${project.id}/extensions`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.marketplace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          displayName: "Prompt Studio Planner",
          installName: "pstdio-planner",
          installed: false,
          origin: {
            kind: "git",
            path: "extensions/pstdio-planner",
            ref: "{hostRelease}",
            url: "https://github.com/pufflyai/prompt-studio",
          },
          publisher: "pufflyai",
        }),
        expect.objectContaining({
          displayName: "Prompt Studio Planner Automation",
          installName: "pstdio-planner-loops",
          installed: false,
        }),
      ]),
    );
    expect(body.marketplace.every((entry: Record<string, unknown>) => !("repositoryPath" in entry))).toBe(true);
    expect(body.marketplace.every((entry: Record<string, unknown>) => !("scope" in entry))).toBe(true);
  });
});

describe("GET /v1/projects/:projectId/extensions read boundary", () => {
  test("does not discover globally installed extensions during a list request", async () => {
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

    expect(row).toBeUndefined();
  });

  test("returns 404 when project does not exist", async () => {
    const res = await app.request("/v1/projects/missing-project/extensions");
    expect(res.status).toBe(404);
  });
});
