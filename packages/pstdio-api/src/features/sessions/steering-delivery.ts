import type { QueuedSteeringResult, SessionAttachmentRef } from "pstdio-api-contracts";
import type { SessionsRouteDeps } from "./deps";
import { hasQueuedSteeringEvidence } from "./queued-steering-evidence";
import { captureActiveSteering, rejectQueuedSteering as rejected } from "./queued-steering-target";
import { SessionAttachmentError, withResolvedSubmittingSessionAttachments } from "./session-attachments";
import { persistSessionMessages } from "./session-messages";
import { withSchedulingLock } from "./session-scheduler-internals";
import type { ActiveSession } from "./session-store";

export type SteeringQueueEntry = NonNullable<
  Awaited<ReturnType<SessionsRouteDeps["sessionQueueEntriesService"]["get"]>>
>;

interface SteeringTarget {
  outcome: undefined;
  projectId: string;
  owner: ActiveSession;
  runtime: NonNullable<ActiveSession["session"]>;
  steer: NonNullable<NonNullable<ActiveSession["session"]>["steer"]>;
  attachmentRefs: SessionAttachmentRef[];
  claim: (delivery: { id: string; runStartedAt: string }) => Promise<SteeringQueueEntry | null>;
  reject: (entry: SteeringQueueEntry, deliveryId: string) => Promise<unknown>;
}

const finishControl = (
  owner: ActiveSession,
  control: { done: Promise<void>; abort: AbortController },
  resolve: () => void,
) => {
  owner.controlInvocations.delete(control);
  resolve();
};

const deliveryGate = async (
  deps: SessionsRouteDeps,
  sessionId: string,
  expectedRunStartedAt: string,
  owner: ActiveSession,
  runtime: ActiveSession["session"],
) => {
  const current = await captureActiveSteering(deps, sessionId, { expectedRunStartedAt });
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

export const deliverSteering = async (
  deps: SessionsRouteDeps,
  sessionId: string,
  expectedRunStartedAt: string,
  capture: () => Promise<SteeringTarget | { outcome: QueuedSteeringResult }>,
) => {
  const prepared = await withSchedulingLock(async () => {
    const target = await capture();
    if (target.outcome !== undefined) return target;
    const { projectId, owner, runtime } = target;
    // Closing a conversation waits for controls, including preparation before native handoff.
    const settled = Promise.withResolvers<void>();
    const control = { done: settled.promise, abort: new AbortController() };
    owner.controlInvocations.add(control);
    const deliveryId = crypto.randomUUID();
    let handedOff = false;
    try {
      return await withResolvedSubmittingSessionAttachments(
        deps,
        projectId,
        target.attachmentRefs,
        async (attachments) => {
          if (owner.session !== runtime || owner.cancellationRequested)
            return { outcome: rejected("inactive", "The active work ended before sending.") };
          const entry = await target.claim({ id: deliveryId, runStartedAt: expectedRunStartedAt });
          if (!entry) return { outcome: rejected("stale_revision", "The queued message changed before sending.") };
          handedOff = true;
          return { outcome: undefined, target, entry, attachments, control, settled, deliveryId };
        },
      );
    } catch (error) {
      if (error instanceof SessionAttachmentError) return { outcome: rejected("invalid_attachments", error.message) };
      throw error;
    } finally {
      if (!handedOff) finishControl(owner, control, settled.resolve);
    }
  });
  if (prepared.outcome !== undefined) return prepared.outcome;
  const { target, entry, attachments, control, settled, deliveryId } = prepared;
  const { owner, runtime, steer } = target;
  try {
    const gate = await deliveryGate(deps, sessionId, expectedRunStartedAt, owner, runtime);
    if (gate) {
      await target.reject(entry, deliveryId);
      return gate;
    }
    const result = await steer({ deliveryId, prompt: entry.prompt, attachments, signal: control.abort.signal });
    if (result.status === "rejected") {
      await target.reject(entry, deliveryId);
      return rejected("delivery_failed", result.reason);
    }
    if (result.status === "accepted") {
      const accepted = await withSchedulingLock(async () => {
        const conversation = await owner.conversationReady;
        const messages = conversation.getMessages();
        if (hasQueuedSteeringEvidence(messages, deliveryId, target.attachmentRefs)) {
          for (const attachment of attachments) owner.submittedAttachmentFileIds.add(attachment.fileId);
          if (!(await persistSessionMessages(sessionId, messages, deps)))
            throw new Error("Conversation was removed before checkpointing.");
          await deps.sessionQueueEntriesService.remove(entry.queue_position);
          return { status: "accepted" as const, deliveryId };
        }
        return null;
      });
      if (accepted) return accepted;
    }
    return {
      status: "uncertain" as const,
      deliveryId,
      message: "Delivery has not been confirmed. The saved message is retained and will not be replayed automatically.",
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
};
