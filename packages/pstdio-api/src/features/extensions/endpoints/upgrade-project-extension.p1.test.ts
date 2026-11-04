import { afterAll, beforeAll, describe, expect, mock, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../../test-utils/create-test-app";
import { folderProjectInput } from "../../../test-utils/folder-project-input";
import { createTestHarnessRegistry } from "../../harnesses/test-harness-registry";
import { hashExtensionSource, loadExtensionSource } from "../extension-runtime";
import { createTestExtensionSource } from "../test-utils/create-test-extension-source";

type AppHandle = Awaited<ReturnType<typeof createTestApp>>;

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
    body: JSON.stringify(folderProjectInput({ name: "Extension Upgrade Project" })),
  });
  return response.json();
};

describe("POST /v1/projects/:projectId/extensions/:instanceId/upgrade", () => {
  test.each([
    "direct",
    "retry upgrade",
    "retry refresh",
  ])("replaces a release extension with complete provisioning: %s", async (mode) => {
    await handle?.close();
    const sourcePath = createTestExtensionSource({
      root: process.env.PSTDIO_HOME!,
      name: "pstdio-planner",
      displayName: "Project Planner",
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

    handle = await createTestApp({
      databasePath: ":memory:",
      storageRoot: join(tempRoot, "storage"),
      harnessRegistry: createTestHarnessRegistry([]),
      release: { source: "git", ref: "f".repeat(40) },
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

    const upgrade = handle.deps.extensionUpgradeService!;
    const originalUpgrade = upgrade.upgrade.bind(upgrade);
    let upgrades = 0;
    const upgrading = spyOn(upgrade, "upgrade").mockImplementation(async (...args) => {
      if (++upgrades === 1 && mode === "retry upgrade") throw new Error("Source unavailable");
      return originalUpgrade(...args);
    });
    const originalList = handle.deps.workspaceService.list.bind(handle.deps.workspaceService);
    let refreshes = 0;
    const refreshing = spyOn(handle.deps.workspaceService, "list").mockImplementation(async (...args) => {
      if (++refreshes === 1 && mode === "retry refresh") throw new Error("Provisioning unavailable");
      return originalList(...args);
    });
    const response = await handle.app.request(`/v1/projects/${project.id}/extensions/${enabled.instance.id}/upgrade`, {
      method: "POST",
    });

    if (mode !== "direct") {
      expect(response.status).toBe(400);
      const job = handle.deps.extensionInstallations.list().find((item) => item.extensionId === loaded.metadata.id)!;
      expect(job.status).toBe("failed");
      handle.deps.extensionInstallations.retry(job.id);
      await handle.deps.extensionInstallations.wait(job.id);
      expect(refreshes).toBe(mode === "retry refresh" ? 2 : 1);
      expect(upgrades).toBe(mode === "retry upgrade" ? 2 : 1);
      const updated = await handle.deps.extensionService.getProjectExtensionInstance(project.id, enabled.instance.id);
      expect(updated?.installedSource.version).toBe("2.0.0");
    } else {
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
    }
    upgrading.mockRestore();
    refreshing.mockRestore();
    expect(installExtensionSource).toHaveBeenCalledWith({
      force: true,
      hostReleaseRef: "f".repeat(40),
      installName: "pstdio-planner",
      reuseInstalledDependencies: true,
      source: "pstdio-planner",
    });
  });
});
