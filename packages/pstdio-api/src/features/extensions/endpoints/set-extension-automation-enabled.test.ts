import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import { resolveTestFilesRoot } from "../../../test-utils/resolve-test-files-root";
import type { AppBindings } from "../../../types";
import { createTestHarnessRecord, createTestHarnessRegistry } from "../../harnesses/test-harness-registry";
import { hashExtensionSource, loadExtensionSource } from "../extension-runtime";
import { createTestScheduledExtensionSource } from "../test-utils/create-test-extension-source";

type AppHandle = Awaited<ReturnType<typeof createApp>>;

let app: OpenAPIHono<AppBindings>;
let handle: AppHandle;
let originalDefaultExtensions: string | undefined;
let originalPstdioHome: string | undefined;
let tempRoot: string;
let counter = 0;

beforeAll(async () => {
  originalDefaultExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  originalPstdioHome = process.env.PSTDIO_HOME;
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-set-extension-automation-enabled-test-"));
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  process.env.PSTDIO_HOME = join(tempRoot, "pstdio-home");
  handle = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: resolveTestFilesRoot(),
    harnessRegistry: createTestHarnessRegistry([createTestHarnessRecord("claude-code")]),
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

const seedScheduledInstance = async (projectId: string) => {
  counter += 1;
  const installName = `automation-source-${counter}`;
  const name = `test-automation-${counter}`;
  const sourcePath = createTestScheduledExtensionSource({
    displayName: `Automation ${counter}`,
    installName,
    name,
    root: tempRoot,
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

  return { instanceId: result.instance.id, automationId: `${name}.heartbeat` };
};

const fetchAutomations = async (projectId: string) => {
  const res = await app.request(`/v1/projects/${projectId}/extensions/ui`);
  expect(res.status).toBe(200);
  const body = await res.json();
  return body.automations as Array<{ id: string; extensionInstanceId?: string; enabled: boolean }>;
};

describe("PATCH /v1/projects/:projectId/extensions/:instanceId/automations/:automationId", () => {
  test("automations default to enabled and can be toggled off", async () => {
    const project = await createProject("Automation Toggle Project");
    const { instanceId, automationId } = await seedScheduledInstance(project.id);

    const before = await fetchAutomations(project.id);
    expect(before.find((automation) => automation.id === automationId)).toMatchObject({
      enabled: true,
      extensionInstanceId: instanceId,
    });

    const res = await app.request(`/v1/projects/${project.id}/extensions/${instanceId}/automations/${automationId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: automationId, enabled: false });

    const after = await fetchAutomations(project.id);
    expect(after.find((automation) => automation.id === automationId)).toMatchObject({ enabled: false });
  });

  test("returns 404 for an automation the extension does not declare", async () => {
    const project = await createProject("Automation Missing Project");
    const { instanceId } = await seedScheduledInstance(project.id);

    const res = await app.request(`/v1/projects/${project.id}/extensions/${instanceId}/automations/unknown.nope`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
    expect(res.status).toBe(404);
  });
});
