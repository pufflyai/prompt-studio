import { existsSync } from "node:fs";
import { join } from "node:path";
import type { createInstalledExtensionSourcesDBService } from "pstdio-db";
import { apiLogger } from "../../lib/logger";
import type { createExtensionService } from "../../services/extension-service";
import type { createProjectService } from "../../services/project-service";
import type { createWorkspaceService } from "../../services/workspace-service";
import type { HarnessRegistryService } from "../harnesses/harness-registry-service";
import { syncInstalledExtensionsForProjects } from "./default-extensions";
import { createExtensionRootWatcher } from "./extension-root-watcher";
import { hashExtensionSourceForHost as hashExtensionSource, type LoadedExtensionSnapshot } from "./extension-runtime";
import { createExtensionSourceWatcher } from "./extension-source-watcher";
import { createExtensionWebviewBuildManager } from "./extension-webview-build-manager";
import { EXTENSION_INSTALLING_MARKER, resolvePstdioHome } from "./install-extension-source";
import type { ProjectExtensionRuntimeCatalog } from "./project-extension-runtime-catalog";
import { listRepoExtensionRoots } from "./repo-extension-roots";
import { syncRepoExtensionsForProject } from "./repo-extensions";

type RuntimeProcess = {
  dispose: () => void;
  refresh: (sourcePath?: string, validatedSource?: LoadedExtensionSnapshot) => Promise<void>;
};

// An installed source whose directory has been removed (project deleted/moved, extension
// uninstalled by hand) is a stale registration, not an error. Skip it so the watcher and the
// webview builder don't fail trying to watch/build a path that no longer exists.
export const selectExistingSources = <T extends { source_path: string }>(
  rows: T[],
  exists: (path: string) => boolean = existsSync,
) => rows.filter((row) => exists(row.source_path) && !exists(join(row.source_path, EXTENSION_INSTALLING_MARKER)));

export const createInstalledExtensionRuntime = (input: {
  createRootWatcher?: typeof createExtensionRootWatcher;
  createSourceWatcher?: typeof createExtensionSourceWatcher;
  createWebviewBuildManager?: typeof createExtensionWebviewBuildManager;
  extensionService: ReturnType<typeof createExtensionService>;
  harnessRegistry: HarnessRegistryService;
  installedExtensionSourcesService: ReturnType<typeof createInstalledExtensionSourcesDBService>;
  projectRuntimeCatalog: ProjectExtensionRuntimeCatalog;
  projectService: ReturnType<typeof createProjectService>;
  provisionWorkspacesUsingSource: (sourcePath: string) => Promise<void>;
  workspaceService: ReturnType<typeof createWorkspaceService>;
  webviewBuilds: boolean;
}) => {
  const userExtensionsRoot = join(resolvePstdioHome({ env: process.env }), "extensions");
  const createRootWatcher = input.createRootWatcher ?? createExtensionRootWatcher;
  const createSourceWatcher = input.createSourceWatcher ?? createExtensionSourceWatcher;
  const createWebviewBuildManager = input.createWebviewBuildManager ?? createExtensionWebviewBuildManager;
  const reportError = (err: unknown) =>
    apiLogger.error({ err, event: "extensions.webview_build.error" }, "Extension webview build manager failed");
  let disposed = false;
  const backgroundWork = new Set<Promise<void>>();
  const trackBackground = (run: () => Promise<void>) => {
    if (disposed) return;
    const work = run().catch(reportError);
    backgroundWork.add(work);
    void work.finally(() => backgroundWork.delete(work));
  };
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
    const roots = await listRepoExtensionRoots({
      projectService: input.projectService,
      workspaceService: input.workspaceService,
    });

    return roots.map((root) => ({
      path: root.rootPath,
      sync: async () => {
        let markedMissing = false;
        for (const project of root.projects) {
          const result = await syncRepoExtensionsForProject({
            extensionService: input.extensionService,
            installedExtensionSourcesService: input.installedExtensionSourcesService,
            projectId: project.projectId,
            repoPath: project.repoPath,
          });
          if (result.missing.length > 0) markedMissing = true;
        }
        // Discovering a source already refreshes through onInstalledSourcesChanged; a removed folder
        // only updates source status directly, so refresh to drop stale source/webview tracking.
        if (markedMissing) await triggerRuntimeRefresh();
      },
    }));
  };

  const rootWatcher = createRootWatcher({
    listExtensionRoots: async () => [userExtensionRootRegistration, ...(await listRepoExtensionRootRegistrations())],
    onError: (err) => apiLogger.error({ err, event: "extensions.root_watcher.error" }, "Extension root watcher failed"),
  });
  const listExistingInstalledSources = async () =>
    selectExistingSources(await input.installedExtensionSourcesService.list());
  const webviewBuildManager: RuntimeProcess & {
    adopt: (sourcePath: string, validatedSource?: LoadedExtensionSnapshot) => Promise<void>;
    ensure: (installedExtensionId: string, webviewId?: string) => Promise<void>;
  } = input.webviewBuilds
    ? createWebviewBuildManager({
        listInstalledSources: listExistingInstalledSources,
        reportBuildFailure: async (installedExtensionId, webviewId, error, expectedSource) => {
          // A snapshot serves each webview's built module URL, so a finished build — for
          // better or worse — changes what the snapshot must say.
          input.projectRuntimeCatalog.invalidate({ sourcePath: expectedSource.sourcePath, reason: "webviews_built" });
          const result = await input.extensionService.reportWebviewBuildFailure(
            installedExtensionId,
            webviewId,
            error,
            expectedSource,
          );
          return result.status;
        },
        reportBuildSuccess: async (installedExtensionId, webviewId, expectedSource) => {
          input.projectRuntimeCatalog.invalidate({ sourcePath: expectedSource.sourcePath, reason: "webviews_built" });
          const result = await input.extensionService.reportWebviewBuildSuccess(
            installedExtensionId,
            webviewId,
            expectedSource,
          );
          return result.status;
        },
        onError: reportError,
      })
    : { adopt: async () => {}, dispose: () => {}, ensure: async () => {}, refresh: async () => {} };
  const refreshWebviewsInBackground = (sourcePath?: string) => {
    trackBackground(async () => {
      await webviewBuildManager.refresh(sourcePath);
      input.projectRuntimeCatalog.invalidate({ sourcePath, reason: "webviews_built" });
    });
  };
  // The source hash each source last provisioned workspaces from. Provisioning can write into a
  // watched folder, so a write that leaves the source unchanged must not provision again.
  const provisionedSourceHashes = new Map<string, string>();
  const provisionWhenSourceChanged = async (sourcePath: string) => {
    // The root watcher handles a removed folder.
    if (!existsSync(sourcePath)) return;
    const sourceHash = await hashExtensionSource(sourcePath);
    if (provisionedSourceHashes.get(sourcePath) === sourceHash) return;
    provisionedSourceHashes.set(sourcePath, sourceHash);
    await input.provisionWorkspacesUsingSource(sourcePath);
  };
  // Editing a watched folder rebuilds the assets of the extension the project already adopted. It
  // never re-reads contributions from disk: adopting new source is an explicit act. Skill files
  // are read from disk, so the edit also re-provisions workspaces to keep harness copies current.
  const sourceWatcher = createSourceWatcher({
    listInstalledSources: listExistingInstalledSources,
    onSourceChanged: async (sourcePath) => {
      // The watcher serializes notifications. Return after scheduling so a later edit can
      // supersede active compilers instead of waiting for their obsolete output.
      refreshWebviewsInBackground(sourcePath);
      trackBackground(() => provisionWhenSourceChanged(sourcePath));
    },
    onError: (err) => apiLogger.error({ err, event: "extensions.source_watcher.error" }, "Extension watcher failed"),
  });

  const refreshWatchers = async () => {
    await (await rootWatcher).refresh();
    await (await sourceWatcher).refresh();
  };

  const refresh = async (sourcePath?: string, validatedSource?: LoadedExtensionSnapshot) => {
    if (sourcePath) {
      // A single changed source invalidates only the projects that use it.
      input.projectRuntimeCatalog.invalidate({ sourcePath, reason: "source_changed" });
      await (await sourceWatcher).refresh(sourcePath);
      await webviewBuildManager.adopt(sourcePath, validatedSource);
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

  // Watchers scan extension folders at startup. The app owns this work, but readiness
  // must not depend on how many extensions are installed or how long their checks take.
  const ready = Promise.all([rootWatcher, sourceWatcher])
    .then(refreshWatchers)
    .then(() => refreshWebviewsInBackground());

  return {
    ready,
    dispose: async () => {
      disposed = true;
      webviewBuildManager.dispose();
      await ready.catch(() => {});
      for (const result of await Promise.allSettled([rootWatcher, sourceWatcher])) {
        if (result.status === "fulfilled") result.value.dispose();
      }
      await Promise.all(backgroundWork);
    },
    ensureWebviews: webviewBuildManager.ensure,
    refresh,
    refreshWatchers,
  };
};
