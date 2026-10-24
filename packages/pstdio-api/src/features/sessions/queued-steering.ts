import { type SteerQueuedFollowUpInput, steerQueuedFollowUpInputSchema } from "pstdio-api-contracts";
import type { SessionsRouteDeps } from "./deps";
import { hasQueuedSteeringEvidence } from "./queued-steering-evidence";
import { captureQueuedSteering } from "./queued-steering-target";
import { getSessionHistory } from "./session-history";
import { persistSessionMessages } from "./session-messages";
import { withSchedulingLock } from "./session-scheduler-internals";
import { deliverSteering } from "./steering-delivery";

export const steerQueuedFollowUp = async (
  deps: SessionsRouteDeps,
  sessionId: string,
  queuePosition: number,
  input: SteerQueuedFollowUpInput,
) => {
  input = steerQueuedFollowUpInputSchema.parse(input);
  return deliverSteering(deps, sessionId, input.expectedRunStartedAt, async () => {
    const target = await captureQueuedSteering(deps, sessionId, queuePosition, input);
    if (target.outcome !== undefined) return target;
    const { entry, projectId, owner, runtime, steer } = target;
    return {
      outcome: undefined,
      projectId,
      owner,
      runtime,
      steer,
      attachmentRefs: entry.attachments_json ?? [],
      claim: (delivery) => deps.sessionQueueEntriesService.claimSteering(queuePosition, entry.revision, delivery),
      reject: (claimed, deliveryId) =>
        deps.sessionQueueEntriesService.releaseSteering(claimed.queue_position, deliveryId),
    };
  });
};

/** Positive history evidence can finish a handoff; absence is never permission to replay. */
export const reconcileQueuedSteering = async (deps: SessionsRouteDeps, sessionId: string) => {
  if (deps.sessionService.store.get(sessionId)) return;
  return withSchedulingLock(async () => {
    if (deps.sessionService.store.get(sessionId)) return;
    const held = await deps.sessionQueueEntriesService.listSteeringDeliveries(sessionId);
    if (!held.length) return;
    const messages = await getSessionHistory(sessionId, deps);
    for (const entry of held) {
      if (!hasQueuedSteeringEvidence(messages, entry.steering_delivery_json!.id, entry.attachments_json ?? []))
        continue;
      if (await persistSessionMessages(sessionId, messages, deps)) {
        await deps.sessionQueueEntriesService.remove(entry.queue_position);
      }
    }
  });
};
