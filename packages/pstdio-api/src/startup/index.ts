import type { RouteDeps } from "../features/deps";
import {
  installDefaultExtensions,
  installMissingDefaultExtensions,
  registerInstalledExtensionSources,
  syncInstalledExtensionsForProjects,
} from "../features/extensions/default-extensions";
import { refreshProjectSkillsInRepos } from "../features/extensions/extension-skill-cleanup";
import { syncRepoExtensionsForProjectFolder } from "../features/extensions/repo-extensions";
import { resolveOrphanedSessions } from "../features/sessions/startup";
import { provisionProjectWorkspaces } from "../features/workspaces/provision-coordinator";
import { reconcileProviderWorkspaces } from "../features/workspaces/workspace-provider-reconciliation";
import { apiLogger } from "../lib/logger";

interface StartupTaskOptions {
  onBackgroundTask?: (task: Promise<void>) => void;
  prepareDefaultExtensions?: (signal?: AbortSignal) => Promise<void>;
  recoverQueuedAutomation?: () => Promise<void>;
  recoverQueuedSessions?: () => Promise<void>;
  recoverOrphanedSessions?: (signal?: AbortSignal) => Promise<void>;
}

const registerBackgroundTask = (task: Promise<void>, options?: StartupTaskOptions) => {
  if (options?.onBackgroundTask) {
    options.onBackgroundTask(task);
    return;
  }
  void task.catch((err) =>
    apiLogger.error({ err, event: "api.startup.background.error" }, "Startup background task failed"),
  );
};

const reconcileProjectWorkspaces = (deps: RouteDeps, projectIds: string[], signal?: AbortSignal) => {
  return Promise.allSettled(
    projectIds.map(async (projectId) => {
      if (signal?.aborted) return;
      await reconcileProviderWorkspaces(deps, projectId, { signal, retryUntilReadyMs: 5_000 });
    }),
  )
    .then((results) => {
      for (const [index, result] of results.entries()) {
        if (result.status === "fulfilled") continue;
        apiLogger.warn(
          { err: result.reason, event: "startup.workspace_recovery.error", project_id: projectIds[index] },
          "Workspace recovery failed during startup",
        );
      }
    })
    .then(() => undefined);
};

const provisionRecoveredWorkspaces = (deps: RouteDeps, projectIds: string[], signal?: AbortSignal) =>
  Promise.allSettled(
    projectIds.map(async (projectId) => {
      if (signal?.aborted) return;
      await provisionProjectWorkspaces(deps, projectId);
    }),
  ).then(() => undefined);

const ensureDefaultExtensionsInstalled = async (deps: RouteDeps, signal?: AbortSignal) => {
  const sourceMode = process.env.PSTDIO_DISABLE_EMBED_MANIFEST === "1";
  try {
    const install = sourceMode ? installDefaultExtensions : installMissingDefaultExtensions;
    const installed = await install({
      extensionInstallations: deps.extensionInstallations,
      forceSourceDefaults: sourceMode,
      onInstallFailure: ({ error, installName, source }) => {
        if (signal?.aborted) return;
        apiLogger.warn(
          {
            err: error,
            event: "startup.default_extension_install.warning",
            extension: installName,
            source,
          },
          "Default extension install failed during startup",
        );
      },
      releaseRef: deps.extensionUpgradeService.releaseRef,
      signal,
    });
    signal?.throwIfAborted();
    await registerInstalledExtensionSources(deps.extensionService, installed);
    if (installed.length) {
      await syncInstalledExtensionsForProjects({
        extensionService: deps.extensionService,
        projectService: deps.projectService,
      });
    }
  } catch (err) {
    if (signal?.aborted) return;
    apiLogger.warn(
      { err, event: "startup.default_extension_install.error" },
      "Default extension install failed during startup",
    );
  }
};

export const runStartupTasks = async (deps: RouteDeps, signal?: AbortSignal, options?: StartupTaskOptions) => {
  await deps.onboarding.resume();
  const defaultExtensionPreparation = (async () => {
    signal?.throwIfAborted();
    if (options?.prepareDefaultExtensions) await options.prepareDefaultExtensions(signal);
    else await ensureDefaultExtensionsInstalled(deps, signal);
  })();
  registerBackgroundTask(defaultExtensionPreparation, options);
  const projectIds = (await deps.projectService.list()).map((project) => project.id);
  signal?.throwIfAborted();
  await reconcileProjectWorkspaces(deps, projectIds, signal);
  signal?.throwIfAborted();
  await options?.recoverQueuedSessions?.();
  const recoverOrphaned = options?.recoverOrphanedSessions ?? ((signal) => resolveOrphanedSessions(deps, signal));
  registerBackgroundTask(recoverOrphaned(signal), options);
  await options?.recoverQueuedAutomation?.();
  signal?.throwIfAborted();
  await syncInstalledExtensionsForProjects({
    extensionService: deps.extensionService,
    onProjectExtensionInstancesPruned: async ({ projectId }) => {
      await refreshProjectSkillsInRepos(deps, projectId);
    },
    projectService: deps.projectService,
  });
  for (const project of await deps.projectService.list()) {
    signal?.throwIfAborted();
    await syncRepoExtensionsForProjectFolder({
      extensionService: deps.extensionService,
      installedExtensionSourcesService: deps.installedExtensionSourcesService,
      projectId: project.id,
      workspaceService: deps.workspaceService,
    });
  }
  registerBackgroundTask(
    defaultExtensionPreparation.then(async () => {
      await provisionRecoveredWorkspaces(deps, projectIds, signal);
      for (const projectId of projectIds) {
        signal?.throwIfAborted();
        await deps.extensionRuntimeCatalog.activate(projectId);
      }
    }),
    options,
  );
};
