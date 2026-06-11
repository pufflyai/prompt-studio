import type { ApprovalRequest, HarnessSession, QuestionResponse } from "pstdio-api-contracts";
import { resolveHarnessExit } from "pstdio-api-runtime-host";
import { sessionLogger } from "../../lib/logger";
import type { SessionsRouteDeps } from "./deps";
import { persistSessionMessages } from "./session-messages";

type SpawnInput = {
  sessionId: string;
  projectId?: string;
  agentId: string;
  prompt: string;
  title?: string;
  model?: string;
  cwd?: string;
};

type SpawnDeps = Pick<SessionsRouteDeps, "harnessRegistry" | "eventBus" | "fileService" | "sessionService"> & {
  processExitTimeoutMs?: number;
};

const DEFAULT_PROCESS_EXIT_TIMEOUT_MS = 10 * 60 * 1000;

const resolveHarness = async (deps: SpawnDeps, agentId: string, projectId?: string) => {
  const harness = await deps.harnessRegistry.get(agentId, { projectId });
  if (harness) return harness;

  if (projectId && (await deps.harnessRegistry.get(agentId))) {
    throw new Error(`Harness not enabled for this project: ${agentId}`);
  }
  throw new Error(`Harness not found: ${agentId}`);
};

const createStoreEntry = (deps: SpawnDeps, sessionId: string) => {
  const entry = deps.sessionService.store.create(sessionId, (request: ApprovalRequest) => {
    entry.eventStore.push({ op: "add", path: "/approval_request", value: request });
  });
  return entry;
};

// Spawns a new harness session and tracks its lifecycle
export const spawnAgentSession = async (input: SpawnInput, deps: SpawnDeps) => {
  const harness = await resolveHarness(deps, input.agentId, input.projectId);
  const entry = createStoreEntry(deps, input.sessionId);

  const session = await harness.start(
    {
      prompt: input.prompt,
      model: input.model,
      cwd: input.cwd,
      sessionId: input.sessionId,
      events: entry.eventStore,
    },
    { projectId: input.projectId },
  );

  if (session.agentSessionId) {
    await deps.sessionService.update(input.sessionId, { agent_session_id: session.agentSessionId });
  }

  deps.sessionService.store.setSession(input.sessionId, session);
  trackHarnessSession(input.sessionId, session, entry.eventStore.subscribe(), deps);

  return session;
};

type ResumeInput = {
  sessionId: string;
  projectId?: string;
  agentSessionId: string;
  agentId: string;
  prompt: string;
  model?: string;
  cwd?: string;
  messageOffset?: number;
  questionResponse?: QuestionResponse;
};

// Resumes an existing harness session with a follow-up prompt
export const resumeAgentSession = async (input: ResumeInput, deps: SpawnDeps) => {
  const harness = await resolveHarness(deps, input.agentId, input.projectId);
  const entry = createStoreEntry(deps, input.sessionId);

  // Resume streams emit index-based message patches, so we align indices with existing history.
  let messageOffset = input.messageOffset;
  if (messageOffset === undefined) {
    try {
      const messages = await harness.getMessages(
        { agentSessionId: input.agentSessionId, cwd: input.cwd },
        { projectId: input.projectId },
      );
      messageOffset = messages.length;
    } catch {
      messageOffset = 0;
    }
  }

  const session = await harness.resume(
    {
      agentSessionId: input.agentSessionId,
      prompt: input.prompt,
      model: input.model,
      cwd: input.cwd,
      sessionId: input.sessionId,
      events: entry.eventStore,
      messageOffset,
      questionResponse: input.questionResponse,
      approvals: entry.approvalService,
    },
    { projectId: input.projectId },
  );

  deps.sessionService.store.setSession(input.sessionId, session);
  trackHarnessSession(input.sessionId, session, entry.eventStore.subscribe(), deps);

  return session;
};

type ReattachInput = {
  sessionId: string;
  projectId?: string;
  agentSessionId: string;
  agentId: string;
  cwd?: string;
};

// Reattaches to a harness session that was orphaned (e.g. by a server restart)
export const reattachAgentSession = async (input: ReattachInput, deps: SpawnDeps) => {
  const harness = await resolveHarness(deps, input.agentId, input.projectId);
  if (!harness.supportsReattach) throw new Error(`Harness does not support reattach: ${input.agentId}`);

  const entry = createStoreEntry(deps, input.sessionId);

  const session = await harness.reattach(
    {
      sessionId: input.sessionId,
      agentSessionId: input.agentSessionId,
      cwd: input.cwd,
      events: entry.eventStore,
    },
    { projectId: input.projectId },
  );

  deps.sessionService.store.setSession(input.sessionId, session);
  trackHarnessSession(input.sessionId, session, entry.eventStore.subscribe(), deps);

  return session;
};

const trackHarnessSession = (
  sessionId: string,
  session: Pick<HarnessSession, "done" | "stop" | "timeoutStrategy">,
  activity: AsyncIterable<unknown>,
  deps: SpawnDeps,
) => {
  resolveHarnessExit({
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
      const entry = deps.sessionService.store.get(sessionId);
      if (entry) {
        const patches = entry.eventStore.getHistory();
        await persistSessionMessages(sessionId, patches, deps).catch((err) => {
          sessionLogger.error(
            {
              err,
              event: "session.messages.persist.error",
              session_id: sessionId,
            },
            "Failed to persist session messages on session exit",
          );
        });
      } else {
        sessionLogger.warn(
          {
            event: "session.store.missing_on_exit",
            session_id: sessionId,
          },
          "No store entry found on session exit; messages were not persisted",
        );
      }

      const current = await deps.sessionService.get(sessionId);
      if (current?.status === "cancelled") {
        deps.sessionService.store.remove(sessionId);
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
      deps.sessionService.store.remove(sessionId);
      await deps.sessionService.transitionStatus(sessionId, exit.status);
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
