import { existsSync } from "node:fs";
import { join } from "node:path";
import type { createInstalledExtensionSourcesDBService } from "pstdio-db";
import { apiLogger } from "../../lib/logger";
import type { createAgentConfigService } from "../../services/agent-config-service";
import type { createExtensionService } from "../../services/extension-service";
import type { createProjectService } from "../../services/project-service";
import type { createRepoService } from "../../services/repo-service";
import { syncInstalledExtensionsForProjects } from "./default-extensions";
import { createExtensionRootWatcher } from "./extension-root-watcher";
import { removePrunedExtensionSkillsFromRepos } from "./extension-skill-cleanup";
import { createExtensionSourceWatcher } from "./extension-source-watcher";
import { createExtensionWebviewBuildManager } from "./extension-webview-build-manager";
import { resolvePstdioHome } from "./install-extension-source";

type RuntimeProcess = {
  dispose: () => void;
  refresh: () => Promise<void>;
};

// An installed source whose directory has been removed (project deleted/moved, extension
// uninstalled by hand) is a stale registration, not an error. Skip it so the watcher and the
// webview builder don't fail trying to watch/build a path that no longer exists.
export const selectExistingSources = <T extends { source_path: string }>(
  rows: T[],
  exists: (path: string) => boolean = existsSync,
) => rows.filter((row) => exists(row.source_path));

export const createInstalledExtensionRuntime = async (input: {
  agentConfigService: ReturnType<typeof createAgentConfigService>;
  createRootWatcher?: typeof createExtensionRootWatcher;
  createSourceWatcher?: typeof createExtensionSourceWatcher;
  createWebviewBuildManager?: typeof createExtensionWebviewBuildManager;
  extensionService: ReturnType<typeof createExtensionService>;
  installedExtensionSourcesService: ReturnType<typeof createInstalledExtensionSourcesDBService>;
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
  const rootWatcher = await createRootWatcher({
    listExtensionRoots: async () => [
      {
        path: userExtensionsRoot,
        sync: () =>
          syncInstalledExtensionsForProjects({
            extensionService: input.extensionService,
            extensionsRoot: userExtensionsRoot,
            onProjectExtensionInstancesPruned: ({ projectId, pruned }) =>
              removePrunedExtensionSkillsFromRepos(input, { projectId, pruned }),
            projectService: input.projectService,
          }),
      },
    ],
    onError: (err) => apiLogger.error({ err, event: "extensions.root_watcher.error" }, "Extension root watcher failed"),
  });
  const listExistingInstalledSources = async () =>
    selectExistingSources(await input.installedExtensionSourcesService.list());
  const sourceWatcher = await createSourceWatcher({
    listInstalledSources: listExistingInstalledSources,
    reloadInstalledSource: (sourcePath) => input.extensionService.reloadInstalledSourceBySourcePath(sourcePath),
    onError: (err) => apiLogger.error({ err, event: "extensions.source_watcher.error" }, "Extension watcher failed"),
  });
  const webviewBuildManager: RuntimeProcess = input.webviewBuilds
    ? createWebviewBuildManager({
        listInstalledSources: listExistingInstalledSources,
        reportBuildFailure: (installName, webviewId, error) =>
          input.extensionService.reportWebviewBuildFailure(installName, webviewId, error),
        reportBuildSuccess: (installName, webviewId) =>
          input.extensionService.reportWebviewBuildSuccess(installName, webviewId),
        onError: reportError,
      })
    : { dispose: () => {}, refresh: async () => {} };

  const refreshWatchers = async () => {
    await rootWatcher.refresh();
    await sourceWatcher.refresh();
  };

  const refreshWebviewsInBackground = () => {
    webviewBuildManager.refresh().catch(reportError);
  };

  const refresh = async () => {
    await refreshWatchers();
    refreshWebviewsInBackground();
  };

  await refreshWatchers();
  await webviewBuildManager.refresh();

  return {
    dispose: () => {
      rootWatcher.dispose();
      sourceWatcher.dispose();
      webviewBuildManager.dispose();
    },
    refresh,
  };
};
