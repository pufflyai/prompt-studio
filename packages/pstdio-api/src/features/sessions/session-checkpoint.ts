import type { SessionsRouteDeps } from "./deps";
import { latestReplyId, persistSessionMessages } from "./session-messages";
import type { ActiveSession } from "./session-store";

type CheckpointDeps = Pick<SessionsRouteDeps, "sessionService" | "fileService">;

export const checkpointConversation = async (
  sessionId: string,
  entry: ActiveSession,
  deps: CheckpointDeps,
  completed = false,
) => {
  if (entry.checkpointPromise) return entry.checkpointPromise;
  await Promise.all(Array.from(entry.controlInvocations, (control) => control.done));
  const conversation = await entry.conversationReady;
  // The snapshot is taken after the last accepted patch, with no await in between.
  conversation.close();
  const messages = conversation.getMessages();
  const replyId = completed ? latestReplyId(messages) : undefined;
  entry.checkpointPromise ??= persistSessionMessages(
    sessionId,
    messages,
    deps,
    replyId !== entry.initialReplyId ? replyId : undefined,
  );
  const pending = entry.checkpointPromise;
  try {
    return await pending;
  } finally {
    if (entry.checkpointPromise === pending) entry.checkpointPromise = undefined;
  }
};
