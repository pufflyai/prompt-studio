import { existsSync } from "node:fs";
import { join } from "node:path";
import type { createInstalledExtensionSourcesDBService } from "pstdio-db";
import { apiLogger } from "../../lib/logger";
import type { createExtensionService } from "../../services/extension-service";
import type { createProjectService } from "../../services/project-service";
import type { createRepoService } from "../../services/repo-service";
import type { HarnessRegistryService } from "../harnesses/harness-registry-service";
import { syncInstalledExtensionsForProjects } from "./default-extensions";
import { createExtensionRootWatcher } from "./extension-root-watcher";
import type { LoadedExtension } from "./extension-runtime";
import { createExtensionSourceWatcher } from "./extension-source-watcher";
import { createExtensionWebviewBuildManager } from "./extension-webview-build-manager";
import { EXTENSION_INSTALLING_MARKER, resolvePstdioHome } from "./install-extension-source";
import type { ProjectExtensionRuntimeCatalog } from "./project-extension-runtime-catalog";
import { listLinkedRepoExtensionRoots } from "./repo-extension-roots";
import { syncRepoExtensionsForProject } from "./repo-extensions";

type RuntimeProcess = {
  dispose: () => void;
  refresh: (sourcePath?: string, validatedSource?: LoadedExtension) => Promise<void>;
};

// An installed source whose directory has been removed (project deleted/moved, extension
// uninstalled by hand) is a stale registration, not an error. Skip it so the watcher and the
// webview builder don't fail trying to watch/build a path that no longer exists.
export const selectExistingSources = <T extends { source_path: string }>(
  rows: T[],
  exists: (path: string) => boolean = existsSync,
) => rows.filter((row) => exists(row.source_path) && !exists(join(row.source_path, EXTENSION_INSTALLING_MARKER)));

export const createInstalledExtensionRuntime = async (input: {
  createRootWatcher?: typeof createExtensionRootWatcher;
  createSourceWatcher?: typeof createExtensionSourceWatcher;
  createWebviewBuildManager?: typeof createExtensionWebviewBuildManager;
  extensionService: ReturnType<typeof createExtensionService>;
  harnessRegistry: HarnessRegistryService;
  installedExtensionSourcesService: ReturnType<typeof createInstalledExtensionSourcesDBService>;
  projectRuntimeCatalog: ProjectExtensionRuntimeCatalog;
  projectService: ReturnType<typeof createProjectService>;
  repoService: ReturnType<typeof createRepoService>;
  webviewBuilds: boolean;
}) => {
  const userExtensionsRoot = join(resolvePstdioHome({ env: process.env }), "extensions");
  const createRootWatcher = input.createRootWatcher ?? createExtensionRootWatcher;
  const createSourceWatcher = input.createSourceWatcher ?? createExtensionSourceWatcher;
  const createWebviewBuildManager = input.createWebviewBuildManager ?? createExtensionWebviewBuildManager;
  const reportError = (err: unknown) =>
    apiLogger.error({ err, event: "extensions.webview_build.error" }, "Extension webview build manager failed");
  // Forward reference to refresh(): a repo root sync that marks sources missing must reconcile the
  // source watcher and webview builds, which are only wired together once all processes exist below.
  let triggerRuntimeRefresh: () => Promise<void> = async () => {};
  const userExtensionRootRegistration = {
    path: userExtensionsRoot,
    sync: () =>
      syncInstalledExtensionsForProjects({
        extensionService: input.extensionService,
        extensionsRoot: userExtensionsRoot,
        projectService: input.projectService,
      }),
  };

  const listRepoExtensionRootRegistrations = async () => {
    const roots = await listLinkedRepoExtensionRoots({
      projectService: input.projectService,
      repoService: input.repoService,
    });

    return roots.map((root) => ({
      path: root.rootPath,
      sync: async () => {
        let markedMissing = false;
        for (const link of root.links) {
          const result = await syncRepoExtensionsForProject({
            extensionService: input.extensionService,
            installedExtensionSourcesService: input.installedExtensionSourcesService,
            projectId: link.projectId,
            repoPath: link.repoPath,
          });
          if (result.missing.length > 0) markedMissing = true;
        }
        // Discovering a source already refreshes through onInstalledSourcesChanged; a removed folder
        // only updates source status directly, so refresh to drop stale source/webview tracking.
        if (markedMissing) await triggerRuntimeRefresh();
      },
    }));
  };

  const rootWatcher = await createRootWatcher({
    listExtensionRoots: async () => [userExtensionRootRegistration, ...(await listRepoExtensionRootRegistrations())],
    onError: (err) => apiLogger.error({ err, event: "extensions.root_watcher.error" }, "Extension root watcher failed"),
  });
  const listExistingInstalledSources = async () =>
    selectExistingSources(await input.installedExtensionSourcesService.list());
  const webviewBuildManager: RuntimeProcess = input.webviewBuilds
    ? createWebviewBuildManager({
        listInstalledSources: listExistingInstalledSources,
        reportBuildFailure: (installName, webviewId, error, expectedSource) => {
          // A snapshot serves each webview's built module URL, so a finished build — for
          // better or worse — changes what the snapshot must say.
          input.projectRuntimeCatalog.invalidate({ sourcePath: expectedSource.sourcePath, reason: "webviews_built" });
          return input.extensionService.reportWebviewBuildFailure(installName, webviewId, error, expectedSource);
        },
        reportBuildSuccess: (installName, webviewId, expectedSource) => {
          input.projectRuntimeCatalog.invalidate({ sourcePath: expectedSource.sourcePath, reason: "webviews_built" });
          return input.extensionService.reportWebviewBuildSuccess(installName, webviewId, expectedSource);
        },
        onError: reportError,
      })
    : { dispose: () => {}, refresh: async () => {} };
  const refreshWebviewsInBackground = (sourcePath?: string) => {
    webviewBuildManager
      .refresh(sourcePath)
      .then(() => input.projectRuntimeCatalog.invalidate({ sourcePath, reason: "webviews_built" }))
      .catch(reportError);
  };
  const sourceWatcher = await createSourceWatcher({
    listInstalledSources: listExistingInstalledSources,
    reloadInstalledSource: (sourcePath) => input.extensionService.reloadInstalledSourceBySourcePath(sourcePath),
    onError: (err) => apiLogger.error({ err, event: "extensions.source_watcher.error" }, "Extension watcher failed"),
  });

  const refreshWatchers = async () => {
    await rootWatcher.refresh();
    await sourceWatcher.refresh();
  };

  const refresh = async (sourcePath?: string, validatedSource?: LoadedExtension) => {
    if (sourcePath) {
      // A single changed source invalidates only the projects that use it.
      input.projectRuntimeCatalog.invalidate({ sourcePath, reason: "source_changed" });
      await sourceWatcher.refresh(sourcePath);
      await webviewBuildManager.refresh(sourcePath, validatedSource);
      // A snapshot serves the module URL of each built webview bundle, so a snapshot
      // read between the source change and the finished build would cache the previous
      // bundle. The build is part of what the snapshot describes: invalidate again.
      input.projectRuntimeCatalog.invalidate({ sourcePath, reason: "webviews_built" });
      return;
    }
    input.projectRuntimeCatalog.invalidate({ reason: "runtime_refresh" });
    await refreshWatchers();
    refreshWebviewsInBackground();
  };
  triggerRuntimeRefresh = refresh;

  await refreshWatchers();
  await webviewBuildManager.refresh();

  return {
    dispose: () => {
      rootWatcher.dispose();
      sourceWatcher.dispose();
      webviewBuildManager.dispose();
    },
    refresh,
    refreshWatchers,
  };
};
