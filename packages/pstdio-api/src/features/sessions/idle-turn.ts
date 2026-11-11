import { sessionLogger } from "../../lib/logger";
import type { SessionsRouteDeps } from "./deps";
import { steerQueuedFollowUp } from "./queued-steering";
import type { ActiveSession } from "./session-store";

const deliverHead = async (deps: SessionsRouteDeps, sessionId: string, entry: ActiveSession) => {
  const turn = entry.idleTurn;
  const current = () => turn !== null && entry.idleTurn === turn && deps.sessionService.store.get(sessionId) === entry;
  if (!current()) return;
  const [head] = await deps.sessionQueueEntriesService.listUndispatchedBySession(sessionId);
  const session = await deps.sessionService.get(sessionId);
  if (!current() || !head || head.steering_delivery_json || !session?.last_request_started) return;
  // A request that could not go in is retried after it changes or the next turn ends, not in a loop.
  const attempt = `${head.queue_position}:${head.revision}`;
  if (entry.idleTurnSkipped === attempt) return;
  const result = await steerQueuedFollowUp(deps, sessionId, head.queue_position, {
    expectedRevision: head.revision,
    expectedRunStartedAt: session.last_request_started,
  });
  if (result.status !== "accepted") {
    if (entry.idleTurn === turn) entry.idleTurnSkipped = attempt;
    return;
  }
  // The provider reports busy when its next turn starts. If it already did, and went idle again,
  // that newer idle turn stays.
  if (entry.idleTurn === turn) entry.turns.busy();
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
