import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
  test("reads the cached runtime without synchronizing installed extensions", async () => {
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
    ).toBeDefined();
  });

  test("lists declared themes as contribution records", async () => {
    const project = await createProject("Themed UI Extension Project");
    const sourcePath = createTestExtensionSource({
      root: pstdioHome,
      name: "themed-extension",
      displayName: "Themed Extension",
      installName: "themed-extension-source",
    });
    writeFileSync(
      join(sourcePath, "midnight-color-theme.json"),
      JSON.stringify({ name: "Midnight", type: "dark", colors: { "editor.background": "#111111" } }),
    );
    writeFileSync(
      join(sourcePath, "extension.ts"),
      `const asset = (path: string) => ({ kind: "package-asset" as const, path, baseUrl: import.meta.url });

export default {
  themes: [
    {
      id: "midnight",
      ref: { kind: "theme", id: "midnight" },
      title: "Midnight",
      format: "vscode-color-theme",
      mode: "dark",
      source: asset("./midnight-color-theme.json"),
    },
  ],
};
`,
    );

    await handle.deps.extensionService.enableInstalledSourceForProject({
      displayName: "Themed Extension",
      extensionId: "test.themed-extension",
      installName: "themed-extension-source",
      manifest: { displayName: "Themed Extension", id: "test.themed-extension", name: "themed-extension" },
      name: "themed-extension",
      projectId: project.id,
      sourcePath,
    });

    const res = await app.request(`/v1/projects/${project.id}/extensions/ui`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.themes).toContainEqual({
      id: "test.themed-extension.theme.midnight",
      localId: "midnight",
      extensionId: "test.themed-extension",
      title: "Midnight",
    });
  });
});
