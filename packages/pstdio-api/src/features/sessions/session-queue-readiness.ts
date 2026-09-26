import { sessionLogger } from "../../lib/logger";
import type { SessionsRouteDeps } from "./deps";

export const isWorkspaceDispatchPending = (
  workspace: Awaited<ReturnType<SessionsRouteDeps["workspaceSessionService"]["getWorkspaceBySessionId"]>>,
) =>
  workspace?.initializing ||
  workspace?.provider_state === "provisioning" ||
  workspace?.provider_state === "provider_missing" ||
  (workspace?.provider_state === "failed" && workspace.provider_error_json?.retryable === true);

// Workspace changes release queued work even when no other session finishes.
// The app owns this listener and waits for its drains before closing storage.
export const watchSessionQueueReadiness = (deps: Pick<SessionsRouteDeps, "eventBus">, drain: () => Promise<void>) => {
  let pending = Promise.resolve();
  const unsubscribe = deps.eventBus.subscribe((event) => {
    if (event.table !== "workspaces" || event.op !== "set") return;
    pending = pending.then(drain).catch((error) => {
      sessionLogger.error(
        { err: error, event: "session.queue.readiness.failed" },
        "Could not drain ready workspace sessions",
      );
    });
  });
  return async () => {
    unsubscribe();
    await pending;
  };
};
