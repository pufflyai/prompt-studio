import { sessionLogger } from "../../lib/logger";
import type { SessionsRouteDeps } from "./deps";
import { recoverDispatchSender } from "./recover-dispatch-sender";
import { createSessionQueueDrain } from "./session-queue-drain";

export const prepareQueuedSessionRecovery = async (deps: SessionsRouteDeps) => {
  const [claimedEntries, pendingEntries] = await Promise.all([
    deps.sessionQueueEntriesService.listDispatchStarted(),
    deps.sessionQueueEntriesService.listPending(),
  ]);
  const queuePositions = new Set([...claimedEntries, ...pendingEntries].map((entry) => entry.queue_position));
  return async () => {
    for (const entry of claimedEntries) {
      try {
        const session = await deps.sessionService.get(entry.session_id);
        if (session?.status === "in_progress" && !deps.sessionService.store.get(session.id)) {
          if (await recoverDispatchSender(deps, session, entry)) continue;
          await deps.sessionService.recoverQueuedDispatchClaim(
            session.id,
            entry.queue_position,
            session.last_request_started,
            { drainCapacity: false },
          );
        }
      } catch (error) {
        sessionLogger.error(
          {
            err: error,
            event: "session.queue.recovery_failed",
            session_id: entry.session_id,
            queue_position: entry.queue_position,
          },
          "Failed to recover queued request; retaining its dispatch guard",
        );
      }
    }
    // A background restart sweep owns only the durable work present before
    // admission. A request accepted afterward owns its own dispatch and completion.
    await createSessionQueueDrain(deps)({ queuePositions });
  };
};
