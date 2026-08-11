import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import { resolveTestFilesRoot } from "../../../test-utils/resolve-test-files-root";
import type { AppBindings } from "../../../types";
import { createTestHarnessRecord, createTestHarnessRegistry } from "../../harnesses/test-harness-registry";
import { hashExtensionSource, loadExtensionSource } from "../extension-runtime";
import { createTestExtensionSource } from "../test-utils/create-test-extension-source";

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
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-reload-project-extension-test-"));
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

const seedEnabledInstance = async (projectId: string) => {
  counter += 1;
  const installName = `reload-source-${counter}`;
  const name = `test-reload-${counter}`;
  const sourcePath = createTestExtensionSource({
    displayName: `Reload ${counter}`,
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

  return { instanceId: result.instance.id, sourcePath };
};

describe("POST /v1/projects/:projectId/extensions/:instanceId/reload", () => {
  test("reloads a broken extension into the error state and back to loaded", async () => {
    const project = await createProject("Reload Project");
    const { instanceId, sourcePath } = await seedEnabledInstance(project.id);

    unlinkSync(join(sourcePath, "extension.ts"));
    const broken = await app.request(`/v1/projects/${project.id}/extensions/${instanceId}/reload`, { method: "POST" });
    expect(broken.status).toBe(200);
    const brokenBody = await broken.json();
    expect(brokenBody.status).toBe("error");
    expect(brokenBody.lastError).toMatchObject({ code: "extension_reload_failed" });

    writeFileSync(join(sourcePath, "extension.ts"), "export default {};\n", "utf8");
    const fixed = await app.request(`/v1/projects/${project.id}/extensions/${instanceId}/reload`, { method: "POST" });
    expect(fixed.status).toBe(200);
    const fixedBody = await fixed.json();
    expect(fixedBody.status).toBe("loaded");
    expect(fixedBody.lastError).toBeNull();
  });

  test("returns 404 for an unknown instance", async () => {
    const project = await createProject("Reload Missing Project");
    const res = await app.request(`/v1/projects/${project.id}/extensions/nope/reload`, { method: "POST" });
    expect(res.status).toBe(404);
  });
});
