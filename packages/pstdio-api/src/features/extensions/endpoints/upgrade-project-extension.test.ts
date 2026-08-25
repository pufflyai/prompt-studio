import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../../app";
import { resolveTestFilesRoot } from "../../../test-utils/resolve-test-files-root";
import { createTestHarnessRegistry } from "../../harnesses/test-harness-registry";
import { hashExtensionSource, loadExtensionSource } from "../extension-runtime";
import { createTestExtensionSource } from "../test-utils/create-test-extension-source";

type AppHandle = Awaited<ReturnType<typeof createApp>>;

let handle: AppHandle;
let originalDefaultExtensions: string | undefined;
let originalPstdioHome: string | undefined;
let tempRoot: string;

beforeAll(async () => {
  originalDefaultExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  originalPstdioHome = process.env.PSTDIO_HOME;
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-upgrade-extension-test-"));
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  process.env.PSTDIO_HOME = join(tempRoot, "pstdio-home");
});

afterAll(async () => {
  await handle?.close();
  if (originalDefaultExtensions === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  else process.env.PSTDIO_DEFAULT_EXTENSIONS = originalDefaultExtensions;
  if (originalPstdioHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = originalPstdioHome;
  rmSync(tempRoot, { recursive: true, force: true });
});

const createProject = async () => {
  const response = await handle.app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Extension Upgrade Project" }),
  });
  return response.json();
};

describe("POST /v1/projects/:projectId/extensions/:instanceId/upgrade", () => {
  test("replaces an older marketplace extension with the version from the host release", async () => {
    const sourcePath = createTestExtensionSource({
      root: process.env.PSTDIO_HOME!,
      name: "pstdio-planner",
      displayName: "Prompt Studio Planner",
      installName: "pstdio-planner",
      version: "1.0.0",
    });
    const loaded = await loadExtensionSource(sourcePath);
    const installExtensionSource = mock(async () => ({
      check: { errorCount: 0 },
      installName: "pstdio-planner",
      manifest: { ...loaded.manifest, version: "2.0.0" },
      metadata: { ...loaded.metadata, version: "2.0.0" },
      source: {
        kind: "named" as const,
        name: "pstdio-planner",
        ref: `https://github.com/pufflyai/prompt-studio@${"b".repeat(40)}#extensions/pstdio-planner`,
      },
      sourceHash: "new-hash",
      targetPath: sourcePath,
    })) as never;

    handle = await createApp({
      dbPath: ":memory:",
      storagePath: join(tempRoot, "storage"),
      filesRoot: resolveTestFilesRoot(),
      harnessRegistry: createTestHarnessRegistry([]),
      extensionReleaseRef: "f".repeat(40),
      installExtensionSource,
    });
    const project = await createProject();
    const enabled = await handle.deps.extensionService.enableInstalledSourceForProject({
      displayName: loaded.metadata.displayName,
      extensionId: loaded.metadata.id,
      installName: "pstdio-planner",
      manifest: loaded.manifest,
      name: loaded.metadata.name,
      projectId: project.id,
      sourceHash: hashExtensionSource(sourcePath),
      sourceKind: "git",
      sourceRef: `https://github.com/pufflyai/prompt-studio@${"a".repeat(40)}#extensions/pstdio-planner`,
      sourcePath,
      version: "1.0.0",
    });

    const response = await handle.app.request(`/v1/projects/${project.id}/extensions/${enabled.instance.id}/upgrade`, {
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      changed: true,
      extension: {
        canUpgrade: false,
        id: enabled.instance.id,
        status: "loaded",
        version: "2.0.0",
      },
    });
    expect(installExtensionSource).toHaveBeenCalledWith(
      expect.objectContaining({ ref: "f".repeat(40), source: "pstdio-planner" }),
    );
  });
});
