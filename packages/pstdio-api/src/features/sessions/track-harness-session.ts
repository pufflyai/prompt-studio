import type { HarnessSession, SessionMessage } from "pstdio-api-contracts";
import { resolveHarnessExit } from "pstdio-api-runtime-host";
import { sessionLogger } from "../../lib/logger";
import type { SessionsRouteDeps } from "./deps";
import { checkpointConversation } from "./session-checkpoint";
import type { ActiveSession } from "./session-store";

type TrackingDeps = Pick<SessionsRouteDeps, "fileService" | "sessionService"> & {
  processExitTimeoutMs?: number;
  sessionQueueEntriesService?: SessionsRouteDeps["sessionQueueEntriesService"];
};

const DEFAULT_PROCESS_EXIT_TIMEOUT_MS = 10 * 60 * 1000;

const messagesReferenceFile = (messages: SessionMessage[], fileId: string) =>
  messages.some((message) => message.parts.some((part) => part.type === "file" && part.fileId === fileId));

const messagesReferenceSubmittedAttachments = (messages: SessionMessage[], fileIds: string[]) =>
  fileIds.every((fileId) => messagesReferenceFile(messages, fileId));

type SubmittedMessages = { submittedAttachmentFileIds: string[]; submittedQueuePosition?: number };
const saveCompletedConversation = async (
  sessionId: string,
  entry: ActiveSession | null,
  deps: TrackingDeps,
  submitted?: SubmittedMessages,
) => {
  if (entry) {
    const messages = await checkpointConversation(sessionId, entry, deps).catch((err) => {
      sessionLogger.error(
        {
          err,
          event: "session.messages.persist.error",
          session_id: sessionId,
        },
        "Failed to persist session messages on session exit",
      );
      return null;
    });

    // Keep the attachment guard until the complete checkpoint is durable.
    if (submitted?.submittedQueuePosition !== undefined && deps.sessionQueueEntriesService) {
      const persistedReference =
        messages !== null && messagesReferenceSubmittedAttachments(messages, submitted.submittedAttachmentFileIds);

      if (persistedReference) {
        await deps.sessionQueueEntriesService.remove(submitted.submittedQueuePosition);
      }
    }
    return messages !== null;
  }
  sessionLogger.warn(
    {
      event: "session.store.missing_on_exit",
      session_id: sessionId,
    },
    "No store entry found on session exit; messages were not persisted",
  );

  return false;
};

export const trackHarnessSession = (
  sessionId: string,
  session: Pick<HarnessSession, "done" | "stop" | "timeoutStrategy">,
  activity: AsyncIterable<unknown>,
  deps: TrackingDeps,
  submitted?: SubmittedMessages,
  entry: ActiveSession | null = deps.sessionService.store.get(sessionId),
) => {
  return resolveHarnessExit({
    session,
    activity,
    timeoutMs: deps.processExitTimeoutMs ?? DEFAULT_PROCESS_EXIT_TIMEOUT_MS,
    onTimeout: () =>
      sessionLogger.error(
        {
          event: "session.process.timeout",
          session_id: sessionId,
          timeout_ms: deps.processExitTimeoutMs ?? DEFAULT_PROCESS_EXIT_TIMEOUT_MS,
        },
        "Harness session timed out without new events; stopping it",
      ),
  })
    .then(async (exit) => {
      if (deps.sessionService.store.get(sessionId) !== entry) return;
      const persisted = await saveCompletedConversation(sessionId, entry, deps, submitted);

      if (deps.sessionService.store.get(sessionId) !== entry) return;
      const current = await deps.sessionService.get(sessionId);
      if (deps.sessionService.store.get(sessionId) !== entry) return;
      if (current?.status === "cancelled") {
        if (persisted && entry) deps.sessionService.store.remove(sessionId, entry);
        return;
      }

      if (exit.status === "failed") {
        sessionLogger.error(
          {
            event: "session.process.exit.failed",
            session_id: sessionId,
          },
          "Harness session exited with failure",
        );
      }
      await deps.sessionService.transitionStatus(sessionId, exit.status, { expectedOwner: entry });
      if (persisted && entry) deps.sessionService.store.remove(sessionId, entry);
    })
    .catch((err) => {
      sessionLogger.error(
        {
          err,
          event: "session.process.exit_tracking.error",
          session_id: sessionId,
        },
        "Session exit tracking failed",
      );
    });
};
