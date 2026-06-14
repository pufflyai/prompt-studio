import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
let tempRoot: string;
let previousPstdioHome: string | undefined;
let previousDefaultExtensions: string | undefined;

beforeEach(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-enable-installed-test-"));
  previousPstdioHome = process.env.PSTDIO_HOME;
  previousDefaultExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_HOME = join(tempRoot, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";

  handle = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: resolveTestFilesRoot(),
  });
  app = handle.app;
});

afterEach(async () => {
  await handle.close();
  if (previousPstdioHome === undefined) {
    delete process.env.PSTDIO_HOME;
  } else {
    process.env.PSTDIO_HOME = previousPstdioHome;
  }
  if (previousDefaultExtensions === undefined) {
    delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  } else {
    process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaultExtensions;
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

const enableBody = (sourcePath: string) => ({
  displayName: "Lab",
  extensionId: "test.lab",
  manifest: { id: "test.lab", name: "lab" },
  name: "lab",
  sourceHash: null,
  sourceKind: "local_path",
  sourcePath,
  sourceRef: null,
  version: "1.0.0",
});

const enableLab = (projectId: string, sourcePath: string) =>
  app.request(`/v1/projects/${projectId}/extensions/installed/lab/enable`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(enableBody(sourcePath)),
  });

describe("POST /v1/projects/:projectId/extensions/installed/:installName/enable", () => {
  test("prefers this host's installed copy over the client-provided source path", async () => {
    const project = await createProject("Own Home Wins");

    const ownCopy = createTestExtensionSource({
      displayName: "Lab",
      installName: "lab",
      name: "lab",
      root: join(tempRoot, "home"),
      version: "1.0.0",
    });
    const foreignCopy = createTestExtensionSource({
      displayName: "Lab",
      installName: "lab",
      name: "lab",
      root: join(tempRoot, "other-home"),
      version: "1.0.0",
    });

    const res = await enableLab(project.id, foreignCopy);
    expect(res.status).toBe(200);
    const body = await res.json();

    const instance = await handle.deps.extensionService.getProjectExtensionInstance(project.id, body.instanceId);
    expect(instance?.installedSource.source_path).toBe(ownCopy);
  });

  test("rejects a source installed under a different pstdio home", async () => {
    const project = await createProject("Foreign Home Rejected");

    const foreignHome = join(tempRoot, "other-home");
    const foreignCopy = createTestExtensionSource({
      displayName: "Lab",
      installName: "lab",
      name: "lab",
      root: foreignHome,
      version: "1.0.0",
    });
    // Mark the other directory as a pstdio home.
    mkdirSync(join(foreignHome, "pstdio.db"), { recursive: true });

    const res = await enableLab(project.id, foreignCopy);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("PSTDIO_HOME");
  });

  test("still enables arbitrary local sources outside any pstdio home", async () => {
    const project = await createProject("Plain Local Source");

    const sourcePath = join(tempRoot, "elsewhere", "lab");
    mkdirSync(sourcePath, { recursive: true });
    writeFileSync(
      join(sourcePath, "package.json"),
      JSON.stringify({
        name: "lab",
        version: "1.0.0",
        publisher: "test",
        main: "./extension.ts",
        engines: { pstdio: "^1.0.0" },
      }),
    );
    writeFileSync(join(sourcePath, "extension.ts"), "export default {};\n");

    const res = await enableLab(project.id, sourcePath);

    expect(res.status).toBe(200);
  });
});
