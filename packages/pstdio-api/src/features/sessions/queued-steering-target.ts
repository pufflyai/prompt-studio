import type { QueuedSteeringResult, SteerQueuedFollowUpInput } from "pstdio-api-contracts";
import type { SessionsRouteDeps } from "./deps";

export const rejectQueuedSteering = (
  reason: Extract<QueuedSteeringResult, { status: "rejected" }>["reason"],
  message: string,
) => ({
  status: "rejected" as const,
  reason,
  message,
});
const paramsKey = (params: Record<string, string | boolean>) =>
  JSON.stringify(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)));

export const captureActiveSteering = async (
  deps: SessionsRouteDeps,
  sessionId: string,
  input: SteerQueuedFollowUpInput,
) => {
  const session = await deps.sessionService.get(sessionId);
  const owner = deps.sessionService.store.get(sessionId);
  const runtime = owner?.session;
  if (!session?.project_id || !runtime || owner.cancellationRequested)
    return { outcome: rejectQueuedSteering("inactive", "The conversation is no longer running.") };
  if (session.last_request_started !== input.expectedRunStartedAt)
    return { outcome: rejectQueuedSteering("stale_run", "The active work changed. Select the queued message again.") };
  if (session.status === "awaiting_input" || owner.questionService.hasPending() || owner.approvalService.hasPending())
    return { outcome: rejectQueuedSteering("blocking_input", "Answer the open question or approval first.") };
  if (!runtime.steer || !owner.executionSettings)
    return { outcome: rejectQueuedSteering("unsupported", "This harness cannot accept live input.") };
  return {
    outcome: undefined,
    projectId: session.project_id,
    session,
    owner,
    runtime,
    steer: runtime.steer.bind(runtime),
    settings: owner.executionSettings,
  };
};

export const captureQueuedSteering = async (
  deps: SessionsRouteDeps,
  sessionId: string,
  queuePosition: number,
  input: SteerQueuedFollowUpInput,
) => {
  const active = await captureActiveSteering(deps, sessionId, input);
  if (active.outcome !== undefined) return active;
  const { projectId, session, owner, runtime, settings, steer } = active;
  const entry = await deps.sessionQueueEntriesService.get(queuePosition);
  if (
    !entry ||
    entry.session_id !== sessionId ||
    entry.request_kind !== "follow_up" ||
    entry.question_response_json ||
    entry.dispatch_started_at
  )
    return { outcome: rejectQueuedSteering("missing", "The queued message is no longer available.") };
  if (entry.steering_delivery_json)
    return {
      outcome: {
        status: "uncertain" as const,
        deliveryId: entry.steering_delivery_json.id,
        message: "Delivery has not been confirmed. This request will not be sent again automatically.",
      },
    };
  if (entry.revision !== input.expectedRevision)
    return { outcome: rejectQueuedSteering("stale_revision", "The queued message changed. Select it again.") };
  if (entry.model !== settings.model || paramsKey(entry.params_json ?? {}) !== paramsKey(settings.params))
    return {
      outcome: rejectQueuedSteering(
        "different_settings",
        "This message needs a new turn to use its model or thinking settings.",
      ),
    };

  return { outcome: undefined, projectId, session, owner, runtime, entry, steer };
};
