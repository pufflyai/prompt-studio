import type { SessionsRouteDeps } from "./deps";
import { recoverMessageSenders } from "./recover-message-senders";
import { getSessionHistory } from "./session-history";
import { persistSessionMessages } from "./session-messages";
import { type ExistingSession, type PendingQueueEntry, withSchedulingLock } from "./session-scheduler-internals";
import { hasSubmittedMessageCheckpoint } from "./submitted-message-checkpoint";
import { submittedRequestId } from "./submitted-message-identity";

// A sender-bearing request can outlive launch while its first checkpoint is pending.
// Positive native/checkpoint evidence retires that guard; it must never start the prompt again.
export const recoverDispatchSender = async (
  deps: SessionsRouteDeps,
  session: ExistingSession,
  entry: PendingQueueEntry,
) => {
  if (!entry.sender_json || entry.sender_json.afterTurn === undefined) return false;
  // Question answers can advance the session timestamp without replacing this request.
  // Its exact checkpoint, rather than the current run timestamp, proves delivery.
  const messages = recoverMessageSenders(await getSessionHistory(session.id, deps), [entry]);
  const requestId = submittedRequestId(session.id, entry.queue_position);
  if (
    !hasSubmittedMessageCheckpoint(messages, {
      sender: { ...entry.sender_json, requestId },
      prompt: entry.prompt,
      submittedAttachmentFileIds: entry.attachments_json?.map((attachment) => attachment.file_id) ?? [],
    })
  )
    return true;
  return withSchedulingLock(async () => {
    const current = await deps.sessionService.get(session.id);
    const saved = await deps.sessionQueueEntriesService.get(entry.queue_position);
    if (
      !current ||
      deps.sessionService.store.get(session.id) ||
      current.last_request_started !== session.last_request_started ||
      current.status !== session.status ||
      !saved ||
      saved.revision !== entry.revision
    )
      return true;
    if (await persistSessionMessages(session.id, messages, deps))
      await deps.sessionQueueEntriesService.remove(entry.queue_position);
    return true;
  });
};
