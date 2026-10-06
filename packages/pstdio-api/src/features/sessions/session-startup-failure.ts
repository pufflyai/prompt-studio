import { sessionLogger } from "../../lib/logger";
import type { SessionsRouteDeps } from "./deps";
import { checkpointConversation } from "./session-checkpoint";
import type { ExistingSession } from "./session-scheduler-internals";
import type { ActiveSession } from "./session-store";

type StartupFailure = {
  error: unknown;
  session: ExistingSession;
  agentId: string;
  cwd?: string;
  model?: string;
  submittedQueuePosition?: number;
  entry?: ActiveSession | null;
};

const cleanUpFailedStart = async (deps: SessionsRouteDeps, input: StartupFailure) => {
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

// Startup failures are often handled in detached promise chains. Cleanup errors are logged here
// so they cannot become unhandled rejections that stop serve.
export const logStartupFailure = async (deps: SessionsRouteDeps, input: StartupFailure) => {
  const context = {
    session_id: input.session.id,
    project_id: input.session.project_id,
    agent: input.agentId,
  };
  sessionLogger.error(
    {
      ...context,
      err: input.error,
      event: "session.spawn.failed",
      cwd: input.cwd ?? null,
      model: input.model ?? null,
    },
    "Agent session startup failed",
  );
  try {
    await cleanUpFailedStart(deps, input);
  } catch (err) {
    sessionLogger.error(
      { ...context, err, event: "session.spawn.cleanup_failed" },
      "Agent session startup cleanup failed",
    );
  }
};
