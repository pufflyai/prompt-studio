import { sessionLogger } from "../../lib/logger";
import type { SessionsRouteDeps } from "./deps";

// Real workspace changes and private maintenance completion both release queued work.
// The app owns this listener and waits for its drains before closing storage.
export const watchSessionQueueReadiness = (
  deps: Pick<SessionsRouteDeps, "eventBus" | "workspaceService">,
  drain: () => Promise<void>,
) => {
  let pending = Promise.resolve();
  const scheduleDrain = () => {
    pending = pending.then(drain).catch((error) => {
      sessionLogger.error(
        { err: error, event: "session.queue.readiness.failed" },
        "Could not drain ready workspace sessions",
      );
    });
  };
  const unsubscribe = deps.eventBus.subscribe((event) => {
    if (event.table === "workspaces" && event.op === "set") scheduleDrain();
  });
  const unsubscribeMaintenance = deps.workspaceService.maintenance.subscribeSettled(scheduleDrain);
  return async () => {
    unsubscribe();
    unsubscribeMaintenance();
    await pending;
  };
};
