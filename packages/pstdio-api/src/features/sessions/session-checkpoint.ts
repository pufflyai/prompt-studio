import type { SessionsRouteDeps } from "./deps";
import { persistSessionMessages } from "./session-messages";
import type { ActiveSession } from "./session-store";

type CheckpointDeps = Pick<SessionsRouteDeps, "sessionService" | "fileService">;

export const checkpointConversation = async (sessionId: string, entry: ActiveSession, deps: CheckpointDeps) => {
  if (entry.checkpointPromise) return entry.checkpointPromise;
  const conversation = await entry.conversationReady;
  // The snapshot is taken after the last accepted patch, with no await in between.
  conversation.close();
  entry.checkpointPromise ??= persistSessionMessages(sessionId, conversation.getMessages(), deps);
  const pending = entry.checkpointPromise;
  try {
    return await pending;
  } finally {
    if (entry.checkpointPromise === pending) entry.checkpointPromise = undefined;
  }
};
