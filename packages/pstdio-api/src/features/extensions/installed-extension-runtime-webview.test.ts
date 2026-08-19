import { describe, expect, test } from "bun:test";
import { createInstalledExtensionRuntime } from "./installed-extension-runtime";

const wait = () => new Promise((resolve) => setTimeout(resolve, 0));

const createProcess = (onRefresh?: (sourcePath?: string) => Promise<void>) => ({
  dispose: () => {},
  refresh: onRefresh ?? (async () => {}),
});

describe("createInstalledExtensionRuntime targeted webview refresh", () => {
  test("waits for a targeted webview build when an installed source changes", async () => {
    let releaseTargetedBuild: () => void = () => {};
    let targetedRefreshFinished = false;
    const refreshedSourcePaths: Array<string | undefined> = [];
    const targetedBuildReleased = new Promise<void>((resolve) => {
      releaseTargetedBuild = resolve;
    });
    const runtime = await createInstalledExtensionRuntime({
      harnessRegistry: {} as never,
      projectRuntimeCatalog: { invalidate: () => {} } as never,
      extensionService: {
        reloadInstalledSourceBySourcePath: async () => {},
        reportBuildFailure: async () => {},
        reportBuildSuccess: async () => {},
      } as never,
      installedExtensionSourcesService: { list: async () => [] } as never,
      projectService: { list: async () => [] } as never,
      repoService: {} as never,
      webviewBuilds: true,
      createRootWatcher: async () => createProcess(),
      createSourceWatcher: async () => createProcess(),
      createWebviewBuildManager: () =>
        createProcess(async (sourcePath) => {
          refreshedSourcePaths.push(sourcePath);
          if (sourcePath) await targetedBuildReleased;
        }),
    });

    try {
      const targetedRefresh = runtime.refresh("/extensions/lab").then(() => {
        targetedRefreshFinished = true;
      });
      await wait();

      expect(refreshedSourcePaths).toEqual([undefined, "/extensions/lab"]);
      expect(targetedRefreshFinished).toBe(false);

      releaseTargetedBuild();
      await targetedRefresh;
      expect(targetedRefreshFinished).toBe(true);
    } finally {
      runtime.dispose();
    }
  });

  test("does not scan extension roots during a targeted source refresh", async () => {
    let rootRefreshCount = 0;
    let releaseUnexpectedRootRefresh: () => void = () => {};
    const unexpectedRootRefreshReleased = new Promise<void>((resolve) => {
      releaseUnexpectedRootRefresh = resolve;
    });
    const sourceRefreshes: Array<string | undefined> = [];
    const webviewRefreshes: Array<string | undefined> = [];
    const runtime = await createInstalledExtensionRuntime({
      harnessRegistry: {} as never,
      projectRuntimeCatalog: { invalidate: () => {} } as never,
      extensionService: {
        reloadInstalledSourceBySourcePath: async () => {},
        reportBuildFailure: async () => {},
        reportBuildSuccess: async () => {},
      } as never,
      installedExtensionSourcesService: { list: async () => [] } as never,
      projectService: { list: async () => [] } as never,
      repoService: {} as never,
      webviewBuilds: true,
      createRootWatcher: async () =>
        createProcess(async () => {
          rootRefreshCount++;
          if (rootRefreshCount > 1) await unexpectedRootRefreshReleased;
        }),
      createSourceWatcher: async () =>
        createProcess(async (sourcePath) => {
          sourceRefreshes.push(sourcePath);
        }),
      createWebviewBuildManager: () =>
        createProcess(async (sourcePath) => {
          webviewRefreshes.push(sourcePath);
        }),
    });
    const targetedRefresh = runtime.refresh("/extensions/lab");

    try {
      await wait();

      expect(rootRefreshCount).toBe(1);
      expect(sourceRefreshes).toEqual([undefined, "/extensions/lab"]);
      expect(webviewRefreshes).toEqual([undefined, "/extensions/lab"]);
    } finally {
      releaseUnexpectedRootRefresh();
      await targetedRefresh;
      runtime.dispose();
    }
  });
});
