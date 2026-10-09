import { type SteerQueuedFollowUpInput, steerQueuedFollowUpInputSchema } from "pstdio-api-contracts";
import type { SessionsRouteDeps } from "./deps";
import { hasQueuedSteeringEvidence } from "./queued-steering-evidence";
import {
  captureActiveSteering,
  captureQueuedSteering,
  rejectQueuedSteering as rejected,
} from "./queued-steering-target";
import { resolveSessionAttachments, SessionAttachmentError } from "./session-attachments";
import { getSessionHistory } from "./session-history";
import { persistSessionMessages } from "./session-messages";
import { withSchedulingLock } from "./session-scheduler-internals";
import type { ActiveSession } from "./session-store";

const finishControl = (
  owner: ActiveSession,
  control: { done: Promise<void>; abort: AbortController },
  resolve: () => void,
) => {
  owner.controlInvocations.delete(control);
  resolve();
};
const finishUnusedControl = (
  handedOff: boolean,
  owner: ActiveSession,
  control: { done: Promise<void>; abort: AbortController },
  resolve: () => void,
) => {
  if (!handedOff) finishControl(owner, control, resolve);
};

const deliveryGate = async (
  deps: SessionsRouteDeps,
  sessionId: string,
  input: SteerQueuedFollowUpInput,
  owner: ActiveSession,
  runtime: ActiveSession["session"],
) => {
  const current = await captureActiveSteering(deps, sessionId, input);
  let gate = current.outcome;
  if (
    !gate &&
    (deps.sessionService.store.get(sessionId) !== owner || owner.session !== runtime || owner.cancellationRequested)
  )
    gate = rejected("inactive", "The active work ended before sending.");
  if (!gate && (owner.questionService.hasPending() || owner.approvalService.hasPending()))
    gate = rejected("blocking_input", "Answer the open question or approval first.");
  return gate;
};

export const steerQueuedFollowUp = (
  deps: SessionsRouteDeps,
  sessionId: string,
  queuePosition: number,
  input: SteerQueuedFollowUpInput,
) =>
  (async () => {
    input = steerQueuedFollowUpInputSchema.parse(input);
    const prepared = await withSchedulingLock(async () => {
      const target = await captureQueuedSteering(deps, sessionId, queuePosition, input);
      if (target.outcome !== undefined) return target;
      const { projectId, owner, runtime, entry, steer } = target;
      // Completion and cancellation already wait for host controls before closing this conversation.
      // Register before resolving files or writing an intent so that handoff keeps the captured owner.
      const settled = Promise.withResolvers<void>();
      const control = { done: settled.promise, abort: new AbortController() };
      owner.controlInvocations.add(control);
      const deliveryId = crypto.randomUUID();
      let handedOff = false;
      try {
        const attachments = await resolveSessionAttachments(deps, projectId, entry.attachments_json ?? []);
        if (owner.session !== runtime || owner.cancellationRequested)
          return { outcome: rejected("inactive", "The active work ended before sending.") };
        const claimed = await deps.sessionQueueEntriesService.claimSteering(queuePosition, entry.revision, {
          id: deliveryId,
          runStartedAt: input.expectedRunStartedAt,
        });
        if (!claimed) return { outcome: rejected("stale_revision", "The queued message changed before sending.") };
        handedOff = true;
        return { outcome: undefined, owner, runtime, steer, entry, attachments, control, settled, deliveryId };
      } catch (error) {
        if (error instanceof SessionAttachmentError) return { outcome: rejected("invalid_attachments", error.message) };
        throw error;
      } finally {
        finishUnusedControl(handedOff, owner, control, settled.resolve);
      }
    });
    if (prepared.outcome !== undefined) return prepared.outcome;
    const { owner, runtime, steer, entry, attachments, control, settled, deliveryId } = prepared;
    try {
      const gate = await deliveryGate(deps, sessionId, input, owner, runtime);
      if (gate) {
        await deps.sessionQueueEntriesService.releaseSteering(queuePosition, deliveryId);
        return gate;
      }
      const result = await steer({ deliveryId, prompt: entry.prompt, attachments, signal: control.abort.signal });
      if (result.status === "rejected") {
        await deps.sessionQueueEntriesService.releaseSteering(queuePosition, deliveryId);
        return rejected("delivery_failed", result.reason);
      }
      if (result.status === "accepted") {
        const accepted = await withSchedulingLock(async () => {
          const conversation = await owner.conversationReady;
          const messages = conversation.getMessages();
          if (hasQueuedSteeringEvidence(messages, deliveryId, entry.attachments_json ?? [])) {
            for (const attachment of attachments) owner.submittedAttachmentFileIds.add(attachment.fileId);
            if (!(await persistSessionMessages(sessionId, messages, deps)))
              throw new Error("Conversation was removed before checkpointing.");
            await deps.sessionQueueEntriesService.remove(queuePosition);
            return { status: "accepted" as const, deliveryId };
          }
          return null;
        });
        if (accepted) return accepted;
      }
      return {
        status: "uncertain" as const,
        deliveryId,
        message:
          "Delivery has not been confirmed. The saved message is retained and will not be replayed automatically.",
      };
    } catch {
      return {
        status: "uncertain" as const,
        deliveryId,
        message:
          "The connection failed before delivery could be confirmed. The saved message will not be replayed automatically.",
      };
    } finally {
      finishControl(owner, control, settled.resolve);
    }
  })();

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
