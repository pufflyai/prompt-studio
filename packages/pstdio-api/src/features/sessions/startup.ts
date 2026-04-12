import type { RouteDeps } from "../deps";

type Deps = Pick<RouteDeps, "sessionService">;

export const resolveOrphanedSessions = async (deps: Deps, signal?: AbortSignal) => {
  const staleSessions = await deps.sessionService.listByStatus("in_progress");
  if (staleSessions.length === 0) return;

  for (const session of staleSessions) {
    if (signal?.aborted) return;

    if (deps.sessionService.store.get(session.id)) continue;

    await deps.sessionService.transitionStatus(session.id, "disconnected");
  }
};
