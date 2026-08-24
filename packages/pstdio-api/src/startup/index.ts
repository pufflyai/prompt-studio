import type { RouteDeps } from "../features/deps";
import {
  installDefaultExtensions,
  registerInstalledExtensionSources,
  syncInstalledExtensionsForProjects,
} from "../features/extensions/default-extensions";
import { refreshProjectSkillsInRepos } from "../features/extensions/extension-skill-cleanup";
import { syncRepoExtensionsForLinkedRepos } from "../features/extensions/repo-extensions";
import { ensureProjectReposScaffolded } from "../features/projects/startup";
import { resolveOrphanedSessions } from "../features/sessions/startup";
import { provisionProjectWorkspaces } from "../features/workspaces/provision-coordinator";
import { apiLogger } from "../lib/logger";

interface StartupTaskOptions {
  recoverQueuedSessions?: () => Promise<void>;
}

const ensureDefaultExtensionsInstalled = async (deps: RouteDeps) => {
  if ((await deps.projectService.list()).length > 0) return;

  try {
    const installed = await installDefaultExtensions({
      forceSourceDefaults: process.env.PSTDIO_DISABLE_EMBED_MANIFEST === "1",
      onInstallFailure: ({ error, installName, source }) => {
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
    });
    await registerInstalledExtensionSources(deps.extensionService, installed);
  } catch (err) {
    apiLogger.warn(
      { err, event: "startup.default_extension_install.error" },
      "Default extension install failed during startup",
    );
  }
};

export const runStartupTasks = async (deps: RouteDeps, signal?: AbortSignal, options?: StartupTaskOptions) => {
  await ensureDefaultExtensionsInstalled(deps);
  await options?.recoverQueuedSessions?.();
  await resolveOrphanedSessions(deps, signal);
  await ensureProjectReposScaffolded(deps);
  await syncInstalledExtensionsForProjects({
    extensionService: deps.extensionService,
    onProjectExtensionInstancesPruned: async ({ projectId }) => {
      await refreshProjectSkillsInRepos(deps, projectId);
    },
    projectService: deps.projectService,
  });
  for (const project of await deps.projectService.list()) {
    await syncRepoExtensionsForLinkedRepos({
      extensionService: deps.extensionService,
      installedExtensionSourcesService: deps.installedExtensionSourcesService,
      projectId: project.id,
      repoService: deps.repoService,
    });
  }
  // Reconcile each project's workspaces so harness extensions sync skills to the current catalog.
  for (const project of await deps.projectService.list()) {
    await provisionProjectWorkspaces(deps, project.id);
  }
};
