import type { RouteDeps } from "../features/deps";
import { resolveOrphanedSessions } from "../features/sessions/startup";

export const runStartupTasks = async (deps: RouteDeps) => {
  await resolveOrphanedSessions(deps);
};
