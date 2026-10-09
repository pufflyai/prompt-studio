import type { SessionsRouteDeps } from "./deps";
import { queuedRequest } from "./queued-request";
import { reconcileQueuedSteering } from "./queued-steering";

export const pendingQueuedRequests = async (deps: SessionsRouteDeps, sessionId: string) => {
  await reconcileQueuedSteering(deps, sessionId);
  const session = await deps.sessionService.get(sessionId);
  const owner = deps.sessionService.store.get(sessionId);
  let reason: string | null = null;
  if (!owner?.session || owner.cancellationRequested) reason = "The conversation is not running.";
  else if (
    session?.status === "awaiting_input" ||
    owner.questionService.hasPending() ||
    owner.approvalService.hasPending()
  )
    reason = "Answer the open question or approval first.";
  else if (!owner.session.steer || !owner.executionSettings) reason = "This harness cannot accept live input.";
  const entries = await deps.sessionQueueEntriesService.listUndispatchedBySession(sessionId);
  const paramsKey = (params: Record<string, string | boolean>) =>
    JSON.stringify(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)));
  return {
    requests: entries.map((entry) => ({
      ...queuedRequest(entry),
      steeringUnavailableReason:
        reason ??
        (owner?.executionSettings &&
        (entry.model !== owner.executionSettings.model ||
          paramsKey(entry.params_json ?? {}) !== paramsKey(owner.executionSettings.params))
          ? "This message needs a new turn to use its model or thinking settings."
          : null),
    })),
    activeRunStartedAt: session?.last_request_started ?? null,
    steeringAvailable: reason === null,
    steeringUnavailableReason: reason,
  };
};
