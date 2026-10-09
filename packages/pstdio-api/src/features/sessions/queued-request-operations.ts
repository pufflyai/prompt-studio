import {
  type CombineQueuedFollowUpsInput,
  combineQueuedFollowUpsInputSchema,
  type UpdateQueuedFollowUpInput,
  updateQueuedFollowUpInputSchema,
} from "pstdio-api-contracts";
import type { SessionsRouteDeps } from "./deps";
import { queuedRequest, validateQueuedRequestEdit } from "./queued-request";
import { resolveSessionAttachments, withResolvedSubmittingSessionAttachments } from "./session-attachments";
import { withSchedulingLock } from "./session-scheduler-internals";

export class QueuedRequestConflict extends Error {}

export const updateQueuedRequest = async (
  deps: SessionsRouteDeps,
  sessionId: string,
  queuePosition: number,
  input: UpdateQueuedFollowUpInput,
) => {
  input = updateQueuedFollowUpInputSchema.parse(input);
  const session = await deps.sessionService.get(sessionId);
  if (!session?.project_id) throw new QueuedRequestConflict("Session not found.");
  return withResolvedSubmittingSessionAttachments(deps, session.project_id, input.attachments, () =>
    withSchedulingLock(async () => {
      const entry = await deps.sessionQueueEntriesService.get(queuePosition);
      if (!entry || entry.session_id !== sessionId || entry.dispatch_started_at || entry.steering_delivery_json)
        throw new QueuedRequestConflict("Queued request is no longer pending.");
      if (input.expectedRevision && input.expectedRevision !== entry.revision)
        throw new QueuedRequestConflict("Queued request changed. Select it again before updating.");
      const payload = await validateQueuedRequestEdit(deps, sessionId, entry, input);
      const updated = await deps.sessionQueueEntriesService.updatePending(queuePosition, payload, entry.revision);
      if (!updated) throw new QueuedRequestConflict("Queued request is being consumed.");
      return queuedRequest(updated);
    }),
  );
};

export const combineQueuedRequests = (
  deps: SessionsRouteDeps,
  sessionId: string,
  targetPosition: number,
  input: CombineQueuedFollowUpsInput,
) =>
  withSchedulingLock(async () => {
    input = combineQueuedFollowUpsInputSchema.parse(input);
    const session = await deps.sessionService.get(sessionId);
    if (!session?.project_id) throw new QueuedRequestConflict("Session not found.");
    const entries = await deps.sessionQueueEntriesService.listPendingBySession(sessionId);
    for (const position of [targetPosition, input.sourcePosition]) {
      const entry = entries.find((entry) => entry.queue_position === position);
      if (!entry) throw new QueuedRequestConflict("Queued request is no longer pending.");
      await resolveSessionAttachments(deps, session.project_id, entry.attachments_json ?? []);
    }
    const combined = await deps.sessionQueueEntriesService.combinePending({ sessionId, targetPosition, ...input });
    if (!combined)
      throw new QueuedRequestConflict(
        "Requests changed or have different model or thinking settings. Select saved requests with matching settings.",
      );
    return queuedRequest(combined);
  });
