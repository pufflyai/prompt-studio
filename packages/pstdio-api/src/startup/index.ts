import type { RouteDeps } from "../features/deps";
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
  await ensureSkillsInstalled(deps);
};
