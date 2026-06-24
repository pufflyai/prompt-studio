import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import { resolveTestFilesRoot } from "../../../test-utils/resolve-test-files-root";
import type { AppBindings } from "../../../types";
import { createTestHarnessRecord, createTestHarnessRegistry } from "../../harnesses/test-harness-registry";
import { createTestExtensionSource } from "../test-utils/create-test-extension-source";

type AppHandle = Awaited<ReturnType<typeof createApp>>;

let app: OpenAPIHono<AppBindings>;
let handle: AppHandle;
let originalDefaultExtensions: string | undefined;
let originalPstdioHome: string | undefined;
let tempRoot: string;

beforeAll(async () => {
  originalDefaultExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  originalPstdioHome = process.env.PSTDIO_HOME;
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-extension-notification-test-"));
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

const createProject = async () => {
  const response = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Extension Notification Project" }),
  });
  expect(response.status).toBe(201);
  return response.json();
};

const enableExtension = async (projectId: string) => {
  const extensionId = "test.notifications";
  const sourcePath = createTestExtensionSource({
    root: tempRoot,
    name: "notifications",
    displayName: "Notifications Extension",
    installName: "notifications-extension",
  });
  const enabled = await handle.deps.extensionService.enableInstalledSourceForProject({
    displayName: "Notifications Extension",
    extensionId,
    installName: "notifications-extension",
    manifest: { id: extensionId, name: "notifications-extension", displayName: "Notifications Extension" },
    name: "notifications",
    projectId,
    sourcePath,
    version: null,
  });
  return enabled.installedSource;
};

describe("POST /v1/projects/:projectId/extensions/:extensionId/notifications", () => {
  test("creates notifications with the enabled extension source attribution", async () => {
    const project = await createProject();
    const installedSource = await enableExtension(project.id);

    const response = await app.request(`/v1/projects/${project.id}/extensions/test.notifications/notifications`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Blocked", kind: "blocked", priority: "high" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      projectId: project.id,
      source: "extension",
      origin: "extension",
      sourceExtensionId: installedSource.id,
      actorId: "test.notifications",
    });
  });
});
