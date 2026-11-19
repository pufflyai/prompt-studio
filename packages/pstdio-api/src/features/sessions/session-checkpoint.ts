import type { SessionsRouteDeps } from "./deps";
import { latestReply, persistSessionMessages, sameReply } from "./session-messages";
import type { ActiveSession } from "./session-store";

type CheckpointDeps = Pick<SessionsRouteDeps, "sessionService" | "fileService">;

export const checkpointConversation = async (
  sessionId: string,
  entry: ActiveSession,
  deps: CheckpointDeps,
  completed = false,
) => {
  if (entry.checkpointPromise) return entry.checkpointPromise;
  const pending = (async () => {
    await Promise.all(Array.from(entry.controlInvocations, (control) => control.done));
    const conversation = await entry.conversationReady;
    while (true) {
      const tail = entry.contentPublications;
      await tail;
      if (entry.contentPublications === tail) break;
    }
    // Snapshot only after every accepted idle/input publication, before another patch can land.
    conversation.close();
    const messages = conversation.getMessages();
    const reply = completed ? latestReply(messages) : undefined;
    return persistSessionMessages(sessionId, messages, deps, !sameReply(reply, entry.initialReply) ? reply : undefined);
  })();
  entry.checkpointPromise = pending;
  try {
    return await pending;
  } finally {
    if (entry.checkpointPromise === pending) entry.checkpointPromise = undefined;
  }
};
