import { describe, expect, test } from "bun:test";
import { createInstalledExtensionRuntime } from "./installed-extension-runtime";

const createProcess = (onRefresh?: (sourcePath?: string) => Promise<void>) => ({
  adopt: onRefresh ?? (async () => {}),
  ensure: async () => {},
  dispose: () => {},
  refresh: onRefresh ?? (async () => {}),
  reconcile: onRefresh ?? (async () => {}),
});

describe("createInstalledExtensionRuntime targeted webview refresh", () => {
  test("waits for a targeted webview build when an installed source changes", async () => {
    let releaseTargetedBuild: () => void = () => {};
    let targetedRefreshFinished = false;
    const targetedStarted = Promise.withResolvers<void>();
    const refreshedSourcePaths: Array<string | undefined> = [];
    const targetedBuildReleased = new Promise<void>((resolve) => {
      releaseTargetedBuild = resolve;
    });
    const runtime = createInstalledExtensionRuntime({
      harnessRegistry: {} as never,
      projectRuntimeCatalog: { invalidate: () => {} } as never,
      provisionWorkspacesUsingSource: async () => {},
      extensionService: {
        reloadInstalledSourceBySourcePath: async () => {},
        reportBuildFailure: async () => {},
        reportBuildSuccess: async () => {},
      } as never,
      installedExtensionSourcesService: { list: async () => [] } as never,
      projectService: { list: async () => [] } as never,
      workspaceService: { getDefault: async () => null } as never,
      webviewBuilds: true,
      createRootWatcher: async () => createProcess(),
      createWebviewBuildManager: () =>
        createProcess(async (sourcePath) => {
          refreshedSourcePaths.push(sourcePath);
          if (sourcePath) {
            targetedStarted.resolve();
            await targetedBuildReleased;
          }
        }),
    });
    await runtime.ready;

    try {
      const targetedRefresh = runtime.refresh("/extensions/lab").then(() => {
        targetedRefreshFinished = true;
      });
      await targetedStarted.promise;

      expect(refreshedSourcePaths).toEqual([undefined, "/extensions/lab"]);
      expect(targetedRefreshFinished).toBe(false);

      releaseTargetedBuild();
      await targetedRefresh;
      expect(targetedRefreshFinished).toBe(true);
    } finally {
      await runtime.dispose();
    }
  });

  test("does not scan extension roots during a targeted source refresh", async () => {
    let rootRefreshCount = 0;
    let releaseUnexpectedRootRefresh: () => void = () => {};
    const unexpectedRootRefreshReleased = new Promise<void>((resolve) => {
      releaseUnexpectedRootRefresh = resolve;
    });
    const unexpectedRoot = Promise.withResolvers<void>();
    const webviewRefreshes: Array<string | undefined> = [];
    const runtime = createInstalledExtensionRuntime({
      harnessRegistry: {} as never,
      projectRuntimeCatalog: { invalidate: () => {} } as never,
      provisionWorkspacesUsingSource: async () => {},
      extensionService: {
        reloadInstalledSourceBySourcePath: async () => {},
        reportBuildFailure: async () => {},
        reportBuildSuccess: async () => {},
      } as never,
      installedExtensionSourcesService: { list: async () => [] } as never,
      projectService: { list: async () => [] } as never,
      workspaceService: { getDefault: async () => null } as never,
      webviewBuilds: true,
      createRootWatcher: async () =>
        createProcess(async () => {
          rootRefreshCount++;
          if (rootRefreshCount > 1) {
            unexpectedRoot.resolve();
            await unexpectedRootRefreshReleased;
          }
        }),
      createWebviewBuildManager: () =>
        createProcess(async (sourcePath) => {
          webviewRefreshes.push(sourcePath);
        }),
    });
    await runtime.ready;
    const targetedRefresh = runtime.refresh("/extensions/lab");

    try {
      expect(
        await Promise.race([targetedRefresh.then(() => "targeted"), unexpectedRoot.promise.then(() => "root")]),
      ).toBe("targeted");

      expect(rootRefreshCount).toBe(1);
      expect(webviewRefreshes).toEqual([undefined, "/extensions/lab"]);
    } finally {
      releaseUnexpectedRootRefresh();
      await targetedRefresh;
      await runtime.dispose();
    }
  });
});
