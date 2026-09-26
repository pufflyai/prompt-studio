import { sessionLogger } from "../../lib/logger";
import type { SessionsRouteDeps } from "./deps";
import { checkpointConversation } from "./session-checkpoint";
import type { ExistingSession } from "./session-scheduler-internals";
import type { ActiveSession } from "./session-store";

export const logStartupFailure = async (
  deps: SessionsRouteDeps,
  input: {
    error: unknown;
    session: ExistingSession;
    agentId: string;
    cwd?: string;
    model?: string;
    submittedQueuePosition?: number;
    entry?: ActiveSession | null;
  },
) => {
  sessionLogger.error(
    {
      err: input.error,
      event: "session.spawn.failed",
      session_id: input.session.id,
      project_id: input.session.project_id,
      agent: input.agentId,
      cwd: input.cwd ?? null,
      model: input.model ?? null,
    },
    "Agent session startup failed",
  );
  const conversation = await input.entry?.conversationReady.catch(() => null);
  conversation?.close();
  const messages = conversation?.getMessages() ?? [];
  const hasSubmittedReferences = messages.some((message) =>
    message.parts.some(
      (part) => part.type === "file" && input.entry?.submittedAttachmentFileIds.has(part.fileId ?? ""),
    ),
  );
  let saved = false;
  if (input.entry && conversation && deps.sessionService.store.get(input.session.id) === input.entry) {
    saved = await checkpointConversation(input.session.id, input.entry, deps)
      .then(() => true)
      .catch(() => false);
  }
  if (input.submittedQueuePosition !== undefined && (!hasSubmittedReferences || saved)) {
    await deps.sessionQueueEntriesService.remove(input.submittedQueuePosition);
  }
  if (!hasSubmittedReferences) input.entry?.submittedAttachmentFileIds.clear();
  await deps.sessionService.transitionStatus(
    input.session.id,
    input.entry?.cancellationRequested ? "cancelled" : "failed",
    {
      expectedLastRequestStarted: input.session.last_request_started,
    },
  );
  if (saved && input.entry) deps.sessionService.store.remove(input.session.id, input.entry);
};
