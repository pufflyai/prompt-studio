import { describe, expect, test } from "bun:test";
import { createInstalledExtensionRuntime } from "./installed-extension-runtime";

const wait = () => new Promise((resolve) => setTimeout(resolve, 0));

const createProcess = (onRefresh?: () => Promise<void>) => ({
  dispose: () => {},
  refresh: onRefresh ?? (async () => {}),
});

describe("createInstalledExtensionRuntime", () => {
  test("does not wait for webview builds when refreshing after source changes", async () => {
    let resolveBackgroundBuild: (() => void) | undefined;
    let webviewRefreshCount = 0;
    const backgroundBuild = new Promise<void>((resolve) => {
      resolveBackgroundBuild = resolve;
    });

    const runtime = await createInstalledExtensionRuntime({
      agentConfigService: {} as never,
      extensionService: {
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
        createProcess(async () => {
          webviewRefreshCount += 1;
          if (webviewRefreshCount === 1) return;
          await backgroundBuild;
        }),
    });

    const refresh = runtime.refresh();
    await wait();

    expect(webviewRefreshCount).toBe(2);
    await expect(refresh).resolves.toBeUndefined();

    resolveBackgroundBuild?.();
    await wait();
    runtime.dispose();
  });
});
