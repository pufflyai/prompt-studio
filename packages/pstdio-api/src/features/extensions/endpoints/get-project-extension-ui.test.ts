import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import { resolveTestFilesRoot } from "../../../test-utils/resolve-test-files-root";
import type { AppBindings } from "../../../types";
import { createTestExtensionSource } from "../test-utils/create-test-extension-source";

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
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-get-project-extension-ui-test-"));
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

describe("GET /v1/projects/:projectId/extensions/ui", () => {
  test("removes enabled extensions whose installed folder was deleted", async () => {
    const project = await createProject("Deleted UI Extension Project");
    const sourcePath = createTestExtensionSource({
      root: pstdioHome,
      name: "deleted-ui-extension",
      displayName: "Deleted UI Extension",
      installName: "deleted-ui-extension-source",
    });

    await handle.deps.extensionService.enableInstalledSourceForProject({
      displayName: "Deleted UI Extension",
      extensionId: "test.deleted-ui-extension",
      installName: "deleted-ui-extension-source",
      manifest: {
        displayName: "Deleted UI Extension",
        id: "test.deleted-ui-extension",
        name: "deleted-ui-extension",
      },
      name: "deleted-ui-extension",
      projectId: project.id,
      sourcePath,
    });

    rmSync(sourcePath, { recursive: true, force: true });

    const res = await app.request(`/v1/projects/${project.id}/extensions/ui`);
    expect(res.status).toBe(200);

    const records = await handle.deps.extensionService.listProjectExtensionInstances(project.id);
    expect(
      records.find(({ installedSource }) => installedSource.install_name === "deleted-ui-extension-source"),
    ).toBeUndefined();
  });
});
