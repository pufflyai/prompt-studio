import { basename } from "node:path";
import type { RouteDeps } from "../features/deps";
import { adoptWorkspacesTool, combinedWorkspacesSource } from "../features/extensions/adopt-workspaces-tool";
import { needsBuiltInGitRecovery } from "../features/extensions/built-in-git-workspaces";
import {
  installDefaultExtensions,
  registerInstalledExtensionSources,
  syncInstalledExtensionsForProjects,
} from "../features/extensions/default-extensions";
import { resolveDefaultExtensionsConfig } from "../features/extensions/default-extensions-config";
import { refreshProjectSkillsInRepos } from "../features/extensions/extension-skill-cleanup";
import { syncRepoExtensionsForProjectFolder } from "../features/extensions/repo-extensions";
import { resumeRestoredFolderSetup } from "../features/projects/project-folder";
import { resolveOrphanedSessions } from "../features/sessions/startup";
import { provisionProjectWorkspaces } from "../features/workspaces/provision-coordinator";
import { reconcileProviderWorkspaces } from "../features/workspaces/workspace-provider-reconciliation";
import { apiLogger } from "../lib/logger";
import { traceSetupPhase } from "../lib/setup-phase";
import { adoptExtractedDefaultTools } from "./extracted-default-tools";
import { canRefreshWorkspacesTool, refreshingWorkspacesEntry } from "./workspaces-tool-upgrade";

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

const recoverProjectWorkspaces = async <T>(
  projectId: string,
  signal: AbortSignal | undefined,
  recover: () => Promise<T>,
) => {
  try {
    signal?.throwIfAborted();
    return await recover();
  } catch (err) {
    signal?.throwIfAborted();
    apiLogger.warn(
      { err, event: "startup.workspace_recovery.error", project_id: projectId },
      "Workspace recovery failed during startup",
    );
  }
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
      const restored = await resumeRestoredFolderSetup(deps, projectId);
      if (signal?.aborted) return;
      await provisionProjectWorkspaces(deps, projectId, undefined, { skipWorkspaceId: restored?.id });
    }),
  ).then(() => undefined);

const ensureDefaultExtensionsInstalled = async (deps: RouteDeps, signal?: AbortSignal) => {
  const sourceMode = process.env.PSTDIO_DISABLE_EMBED_MANIFEST === "1";
  const projects = await deps.projectService.list();
  const existingProjects = !sourceMode && projects.length > 0;
  const workspaceSource = await deps.extensionService.getInstalledSource("pstdio.workspaces");
  const hasCombinedWorkspaces = workspaceSource
    ? await combinedWorkspacesSource(workspaceSource.source_path).catch(() => false)
    : false;
  const terminalChosen = (
    await Promise.all(
      projects.map(({ id }) => deps.extensionService.hasDefaultSourceChoice(id, "pstdio.pstdio-terminal")),
    )
  ).every(Boolean);
  const needsWorkspaceUpgrade =
    existingProjects &&
    !hasCombinedWorkspaces &&
    (
      await Promise.all(
        projects.map(({ id }) =>
          recoverProjectWorkspaces(id, signal, async () => {
            const records = await deps.extensionService.listProjectExtensionInstances(id);
            return (
              records.some(
                ({ instance, installedSource }) =>
                  instance.enabled && installedSource.extension_id === "pstdio.git-workspaces",
              ) || (await needsBuiltInGitRecovery(deps, id, records))
            );
          }),
        ),
      )
    ).some(Boolean);

  const refreshWorkspaces = needsWorkspaceUpgrade && (await canRefreshWorkspacesTool(workspaceSource));

  try {
    if (existingProjects && !needsWorkspaceUpgrade && terminalChosen) return;
    return await installDefaultExtensions({
      ...(existingProjects
        ? {
            env: {
              ...process.env,
              PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify(
                (await resolveDefaultExtensionsConfig()).defaultExtensions
                  .filter(
                    (entry) =>
                      (!terminalChosen &&
                        (typeof entry === "string"
                          ? basename(entry)
                          : (entry.installName ?? basename(entry.source))) === "pstdio-terminal") ||
                      (needsWorkspaceUpgrade &&
                        (typeof entry === "string"
                          ? basename(entry)
                          : (entry.installName ?? basename(entry.source))) === "workspaces"),
                  )
                  .map((entry) =>
                    refreshWorkspaces &&
                    (typeof entry === "string" ? basename(entry) : (entry.installName ?? basename(entry.source))) ===
                      "workspaces"
                      ? refreshingWorkspacesEntry(entry)
                      : entry,
                  ),
              ),
            },
          }
        : {}),
      registerInstalledSources: (installed) =>
        traceSetupPhase("default_extensions.register", {}, () =>
          registerInstalledExtensionSources(deps.extensionService, installed),
        ),
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
  } catch (err) {
    if (signal?.aborted) return;
    apiLogger.warn(
      { err, event: "startup.default_extension_install.error" },
      "Default extension install failed during startup",
    );
  }
};

export const runStartupTasks = async (deps: RouteDeps, signal?: AbortSignal, options?: StartupTaskOptions) => {
  const defaultExtensionPreparation = (async () => {
    signal?.throwIfAborted();
    if (options?.prepareDefaultExtensions) {
      await options.prepareDefaultExtensions(signal);
      return [];
    }
    return (await ensureDefaultExtensionsInstalled(deps, signal)) ?? [];
  })();
  registerBackgroundTask(
    defaultExtensionPreparation.then(() => undefined),
    options,
  );
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
    defaultExtensionPreparation.then(async (installed) => {
      await adoptExtractedDefaultTools(deps, projectIds, signal, ["pstdio-terminal"]);
      for (const projectId of projectIds)
        await recoverProjectWorkspaces(projectId, signal, () =>
          adoptWorkspacesTool(
            deps,
            projectId,
            installed.map(({ targetPath, sourceHash }) => ({ path: targetPath, hash: sourceHash })),
          ),
        );
      await provisionRecoveredWorkspaces(deps, projectIds, signal);
      for (const projectId of projectIds) {
        signal?.throwIfAborted();
        await deps.extensionRuntimeCatalog.activate(projectId);
      }
    }),
    options,
  );
};
