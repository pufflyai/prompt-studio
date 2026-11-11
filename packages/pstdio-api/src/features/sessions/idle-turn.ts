import { sessionLogger } from "../../lib/logger";
import type { SessionsRouteDeps } from "./deps";
import { steerQueuedFollowUp } from "./queued-steering";
import type { ActiveSession } from "./session-store";

const deliverHead = async (deps: SessionsRouteDeps, sessionId: string, entry: ActiveSession) => {
  if (!entry.idleTurn || deps.sessionService.store.get(sessionId) !== entry) return;
  const [head] = await deps.sessionQueueEntriesService.listUndispatchedBySession(sessionId);
  const session = await deps.sessionService.get(sessionId);
  if (!head || head.steering_delivery_json || !session?.last_request_started) return;
  const result = await steerQueuedFollowUp(deps, sessionId, head.queue_position, {
    expectedRevision: head.revision,
    expectedRunStartedAt: session.last_request_started,
  });
  // The provider reports busy when its next turn starts; the request is already in before that.
  if (result.status === "accepted") entry.turns.busy();
};

/**
 * Sends the oldest queued follow-up into a run whose turn has ended. Queue order holds: when that
 * request cannot go in now, such as one that needs other settings, later requests wait behind it.
 * Calls run one after another, so a request queued during a delivery is checked afterwards.
 */
export const deliverIdleFollowUp = (deps: SessionsRouteDeps, sessionId: string) => {
  const entry = deps.sessionService.store.get(sessionId);
  if (!entry?.idleTurn) return Promise.resolve();
  entry.idleDelivery = entry.idleDelivery
    .then(() => deliverHead(deps, sessionId, entry))
    .catch((err) => {
      // Nobody awaits this delivery; the request stays queued for the next idle turn or run.
      sessionLogger.error(
        { err, event: "session.idle_turn.delivery.error", session_id: sessionId },
        "Failed to deliver a queued follow-up to an idle turn",
      );
    });
  return entry.idleDelivery;
};
