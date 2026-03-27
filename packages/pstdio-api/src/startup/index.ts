import type { RouteDeps } from "../features/deps";
import { resolveOrphanedSessions } from "../features/sessions/startup";
import { ensureSkillsInstalled } from "../features/skills/startup";

export const runStartupTasks = async (deps: RouteDeps, signal?: AbortSignal) => {
  await resolveOrphanedSessions(deps, signal);
  await ensureSkillsInstalled(deps);
};
