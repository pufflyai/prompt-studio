import type { RouteDeps } from "../features/deps";
import { ensureProjectReposScaffolded } from "../features/projects/startup";
import { resolveOrphanedSessions } from "../features/sessions/startup";
import { ensureSkillsInstalled } from "../features/skills/startup";

export const runStartupTasks = async (deps: RouteDeps, signal?: AbortSignal) => {
  await resolveOrphanedSessions(deps, signal);
  await ensureProjectReposScaffolded(deps);
  await ensureSkillsInstalled(deps);
};
