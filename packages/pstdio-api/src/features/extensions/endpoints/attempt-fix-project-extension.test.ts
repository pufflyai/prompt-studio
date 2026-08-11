import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, unlinkSync } from "node:fs";
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
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-attempt-fix-project-extension-test-"));
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
  const installName = `fix-source-${counter}`;
  const name = `test-fix-${counter}`;
  const sourcePath = createTestExtensionSource({
    displayName: `Fixable ${counter}`,
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

  return { instanceId: result.instance.id, installName, sourcePath };
};

describe("POST /v1/projects/:projectId/extensions/:instanceId/attempt-fix", () => {
  test("creates a repair session seeded with the load error", async () => {
    const project = await createProject("Attempt Fix Project");
    const { instanceId, installName, sourcePath } = await seedEnabledInstance(project.id);

    unlinkSync(join(sourcePath, "extension.ts"));
    await handle.deps.extensionService.reloadInstalledSource(installName);

    const res = await app.request(`/v1/projects/${project.id}/extensions/${instanceId}/attempt-fix`, {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionId).toBeString();

    const session = await handle.deps.sessionService.get(body.sessionId);
    expect(session).toBeTruthy();
    expect(session?.title).toContain("Fixable");
    expect(session?.cwd).toBe(sourcePath);
  });

  test("returns 409 when the extension has no load error", async () => {
    const project = await createProject("Attempt Fix Healthy Project");
    const { instanceId } = await seedEnabledInstance(project.id);

    const res = await app.request(`/v1/projects/${project.id}/extensions/${instanceId}/attempt-fix`, {
      method: "POST",
    });
    expect(res.status).toBe(409);
  });
});
