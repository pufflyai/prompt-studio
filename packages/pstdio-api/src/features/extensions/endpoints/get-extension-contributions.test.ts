import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createTestApp } from "../../../test-utils/create-test-app";
import type { AppBindings } from "../../../types";
import { hashExtensionSource, loadExtensionSource } from "../extension-runtime";
import { createTestScheduledExtensionSource } from "../test-utils/create-test-extension-source";

type AppHandle = Awaited<ReturnType<typeof createTestApp>>;

let app: OpenAPIHono<AppBindings>;
let handle: AppHandle;
let originalDefaultExtensions: string | undefined;
let originalPstdioHome: string | undefined;
let tempRoot: string;

beforeAll(async () => {
  originalDefaultExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  originalPstdioHome = process.env.PSTDIO_HOME;
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-get-extension-contributions-test-"));
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  process.env.PSTDIO_HOME = join(tempRoot, "pstdio-home");
  handle = await createTestApp({
    databasePath: ":memory:",
    storageRoot: join(tempRoot, "storage"),
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

describe("GET /v1/projects/:projectId/extensions/:instanceId/contributions", () => {
  test("lists contributions for a disabled extension", async () => {
    const project = await createProject("Disabled Contributions Project");
    const name = "test-disabled-contrib";
    const sourcePath = createTestScheduledExtensionSource({
      displayName: "Disabled Contrib",
      installName: name,
      name,
      root: tempRoot,
      version: "1.0.0",
    });
    const loaded = await loadExtensionSource(sourcePath);
    const result = await handle.deps.extensionService.enableInstalledSourceForProject({
      displayName: loaded.metadata.displayName,
      extensionId: loaded.metadata.id,
      installName: name,
      manifest: loaded.manifest,
      name: loaded.metadata.name,
      projectId: project.id,
      sourceHash: hashExtensionSource(sourcePath),
      sourcePath,
      version: loaded.metadata.version ?? null,
    });

    await handle.deps.extensionService.setProjectExtensionEnabled(result.instance.id, false);

    const res = await app.request(`/v1/projects/${project.id}/extensions/${result.instance.id}/contributions`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.commands.map((command: { id: string }) => command.id)).toContain(`test.${name}.command.heartbeat`);
    expect(body.automations.map((automation: { id: string }) => automation.id)).toContain(
      `test.${name}.schedule.heartbeat`,
    );
  });

  test("returns 404 for an unknown instance", async () => {
    const project = await createProject("Missing Contributions Project");
    const res = await app.request(`/v1/projects/${project.id}/extensions/nope/contributions`);
    expect(res.status).toBe(404);
  });
});
