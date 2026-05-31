import type { RouteDeps } from "../features/deps";
import { syncInstalledExtensionsForProjects } from "../features/extensions/default-extensions";
import {
  refreshProjectSkillsInRepos,
  removePrunedExtensionSkillsFromRepos,
} from "../features/extensions/extension-skill-cleanup";
import { syncRepoExtensionsForLinkedRepos } from "../features/extensions/repo-extensions";
import { ensureProjectReposScaffolded } from "../features/projects/startup";
import { resolveOrphanedSessions } from "../features/sessions/startup";
import { ensureSkillsInstalled } from "../features/skills/startup";

interface StartupTaskOptions {
  recoverQueuedSessions?: () => Promise<void>;
}

export const runStartupTasks = async (deps: RouteDeps, signal?: AbortSignal, options?: StartupTaskOptions) => {
  await options?.recoverQueuedSessions?.();
  await resolveOrphanedSessions(deps, signal);
  await ensureProjectReposScaffolded(deps);
  await syncInstalledExtensionsForProjects({
    extensionService: deps.extensionService,
    onProjectExtensionInstancesPruned: async ({ projectId, pruned }) => {
      await removePrunedExtensionSkillsFromRepos(deps, { projectId, pruned });
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
  await ensureSkillsInstalled(deps);
};
