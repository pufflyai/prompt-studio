import type { SessionMessage } from "pstdio-api-contracts";
import type { SessionsRouteDeps } from "./deps";
import { recoverMessageSenders } from "./recover-message-senders";
import { getSessionHistory, readSessionCheckpointSnapshot } from "./session-history";
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
  const sender = entry.sender_json;
  const checkpointInput = {
    sender: { ...sender, requestId: submittedRequestId(session.id, entry.queue_position) },
    prompt: entry.prompt,
    submittedAttachmentFileIds: entry.attachments_json?.map((attachment) => attachment.file_id) ?? [],
  };
  const readCurrentCheckpoint = async () => {
    const before = await deps.sessionService.get(session.id);
    if (!before) return null;
    const checkpoint = await readSessionCheckpointSnapshot(before, deps);
    const current = await deps.sessionService.get(session.id);
    const saved = await deps.sessionQueueEntriesService.get(entry.queue_position);
    if (
      !current ||
      deps.sessionService.store.get(session.id) ||
      current.last_request_started !== session.last_request_started ||
      current.status !== session.status ||
      current.session_file_id !== before.session_file_id ||
      !saved ||
      saved.revision !== entry.revision
    )
      return null;
    return { messages: checkpoint.messages, fingerprint: checkpoint.fingerprint };
  };
  const saveCheckpoint = async (messages: SessionMessage[]) => {
    if (await persistSessionMessages(session.id, messages, deps))
      await deps.sessionQueueEntriesService.remove(entry.queue_position);
  };
  const initial = await withSchedulingLock(async () => {
    const checkpoint = await readCurrentCheckpoint();
    if (!checkpoint) return null;
    // A durable exact request already proves delivery, even after a question
    // advances the run timestamp. Do not consult the provider for that proof.
    if (hasSubmittedMessageCheckpoint(checkpoint.messages ?? [], checkpointInput)) {
      await saveCheckpoint(checkpoint.messages!);
      return null;
    }
    return { fingerprint: checkpoint.fingerprint };
  });
  if (!initial) return true;

  // Provider history and harness reconciliation may wait on remote I/O. Keep
  // that work outside the shared lock so other projects can keep sending.
  const messages = recoverMessageSenders(await getSessionHistory(session.id, deps), [entry]);
  return withSchedulingLock(async () => {
    const checkpoint = await readCurrentCheckpoint();
    if (!checkpoint) return true;
    if (hasSubmittedMessageCheckpoint(checkpoint.messages ?? [], checkpointInput)) {
      await saveCheckpoint(checkpoint.messages!);
      return true;
    }
    // Another writer can retire its steering guard while history is loading.
    // Retain this guard rather than overwrite a changed checkpoint with a stale snapshot.
    if (checkpoint.fingerprint !== initial.fingerprint) return true;
    if (hasSubmittedMessageCheckpoint(messages, checkpointInput)) await saveCheckpoint(messages);
    return true;
  });
};
