import type { AgentId, ApprovalRequest, QuestionResponse, SpawnedProcess } from "pstdio-agents";
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

type SpawnDeps = Pick<SessionsRouteDeps, "agentRegistry" | "eventBus" | "fileService" | "sessionService"> & {
  processExitTimeoutMs?: number;
};

const DEFAULT_PROCESS_EXIT_TIMEOUT_MS = 10 * 60 * 1000;
type TrackedExitStatus = "disconnected" | "cancelled" | "completed" | "failed";

const sessionEnv = (input: { sessionId: string; projectId?: string }) => ({
  PSTDIO_SESSION_ID: input.sessionId,
  ...(input.projectId ? { PSTDIO_PROJECT_ID: input.projectId } : {}),
});

const resolveExitStatus = (exit: { code: number | null; signal: string | null }): TrackedExitStatus => {
  if (exit.signal === "TIMEOUT") return "disconnected";
  if (exit.signal === "SIGTERM" || exit.signal === "SIGINT") return "cancelled";
  return exit.code === 0 ? "completed" : "failed";
};

const withProcessExitTimeout = (
  sessionId: string,
  process: Pick<SpawnedProcess, "kill" | "onExit">,
  activity: AsyncIterable<unknown>,
  timeoutMs: number,
) =>
  new Promise<{ code: number | null; signal: string | null }>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const activityIterator = activity[Symbol.asyncIterator]();

    const settle = (result: { code: number | null; signal: string | null }) => {
      if (settled) return;
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      void activityIterator.return?.();
      resolve(result);
    };

    const killProcess = () => {
      sessionLogger.error(
        {
          event: "session.process.timeout",
          session_id: sessionId,
          timeout_ms: timeoutMs,
        },
        "Agent process timed out without new events; killing process",
      );

      try {
        process.kill();
      } catch (error) {
        sessionLogger.error(
          {
            err: error,
            event: "session.process.kill.error",
            session_id: sessionId,
          },
          "Failed to kill timed out agent process",
        );
      }

      settle({ code: null, signal: "SIGKILL" });
    };

    const resetTimer = () => {
      if (timer) {
        clearTimeout(timer);
      }

      timer = setTimeout(() => {
        killProcess();
      }, timeoutMs);
    };

    resetTimer();

    void (async () => {
      try {
        while (!settled) {
          const { done } = await activityIterator.next();
          if (done || settled) break;
          resetTimer();
        }
      } catch (error) {
        if (!settled) {
          sessionLogger.error(
            {
              err: error,
              event: "session.activity_watcher.error",
              session_id: sessionId,
            },
            "Session activity watcher failed",
          );
        }
      }
    })();

    process.onExit.then(settle).catch((error) => {
      if (settled) return;
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      void activityIterator.return?.();
      reject(error);
    });
  });

// Spawns a new agent session and tracks the process lifecycle
export const spawnAgentSession = async (input: SpawnInput, deps: SpawnDeps) => {
  const agent = deps.agentRegistry.get(input.agentId as AgentId);
  if (!agent) throw new Error(`Agent not found: ${input.agentId}`);

  const entry = deps.sessionService.store.create(input.sessionId, (request: ApprovalRequest) => {
    entry.eventStore.push({ op: "add", path: "/approval_request", value: request });
  });

  const result = await agent.startSession({
    prompt: input.prompt,
    title: input.title,
    model: input.model,
    cwd: input.cwd,
    env: sessionEnv(input),
    eventStore: entry.eventStore,
  });

  if (result.sessionId) {
    await deps.sessionService.update(input.sessionId, { agent_session_id: result.sessionId });
  }

  if (result.process) {
    deps.sessionService.store.setProcess(input.sessionId, result.process);
    trackProcessLifecycle(input.sessionId, result.process, entry.eventStore.subscribe(), deps);
  }

  return result;
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

// Resumes an existing agent session with a follow-up prompt
export const resumeAgentSession = async (input: ResumeInput, deps: SpawnDeps) => {
  const agent = deps.agentRegistry.get(input.agentId as AgentId);
  if (!agent) throw new Error(`Agent not found: ${input.agentId}`);

  const entry = deps.sessionService.store.create(input.sessionId, (request: ApprovalRequest) => {
    entry.eventStore.push({ op: "add", path: "/approval_request", value: request });
  });

  // Resume streams emit index-based message patches, so we align indices with existing history.
  let messageOffset = input.messageOffset;
  if (messageOffset === undefined) {
    try {
      const messages = await agent.getMessages(input.agentSessionId, input.cwd ? { cwd: input.cwd } : undefined);
      messageOffset = messages.length;
    } catch {
      messageOffset = 0;
    }
  }

  const result = await agent.resumeSession(
    {
      sessionId: input.agentSessionId,
      prompt: input.prompt,
      model: input.model,
      cwd: input.cwd,
      env: sessionEnv(input),
      messageOffset,
      questionResponse: input.questionResponse,
    },
    entry.eventStore,
    entry.approvalService,
  );

  if (result.process) {
    deps.sessionService.store.setProcess(input.sessionId, result.process);
    trackProcessLifecycle(input.sessionId, result.process, entry.eventStore.subscribe(), deps);
  } else {
    sessionLogger.warn(
      {
        event: "session.resume.no_process",
        session_id: input.sessionId,
      },
      "Resume returned no process; session status remains in_progress",
    );
  }

  return result;
};

type ReattachInput = {
  sessionId: string;
  agentSessionId: string;
  agentId: string;
  cwd?: string;
};

// Reattaches to an existing opencode session that was orphaned (e.g. by a server restart)
export const reattachAgentSession = async (input: ReattachInput, deps: SpawnDeps) => {
  const agent = deps.agentRegistry.get(input.agentId as AgentId);
  if (!agent?.reattachSession) throw new Error(`Agent does not support reattach: ${input.agentId}`);

  const entry = deps.sessionService.store.create(input.sessionId, (request: ApprovalRequest) => {
    entry.eventStore.push({ op: "add", path: "/approval_request", value: request });
  });

  const result = await agent.reattachSession({ sessionId: input.agentSessionId, cwd: input.cwd }, entry.eventStore);

  if (result.process) {
    deps.sessionService.store.setProcess(input.sessionId, result.process);
    trackProcessLifecycle(input.sessionId, result.process, entry.eventStore.subscribe(), deps);
  }

  return result;
};

const trackProcessLifecycle = (
  sessionId: string,
  process: Pick<SpawnedProcess, "kill" | "onExit" | "timeoutStrategy">,
  activity: AsyncIterable<unknown>,
  deps: SpawnDeps,
) => {
  const exitPromise =
    process.timeoutStrategy === "provider"
      ? process.onExit
      : withProcessExitTimeout(
          sessionId,
          process,
          activity,
          deps.processExitTimeoutMs ?? DEFAULT_PROCESS_EXIT_TIMEOUT_MS,
        );

  exitPromise
    .then(async ({ code, signal }) => {
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
            "Failed to persist session messages on process exit",
          );
        });
      } else {
        sessionLogger.warn(
          {
            event: "session.store.missing_on_exit",
            session_id: sessionId,
          },
          "No store entry found on process exit; messages were not persisted",
        );
      }

      const current = await deps.sessionService.get(sessionId);
      if (current?.status === "cancelled") {
        deps.sessionService.store.remove(sessionId);
        return;
      }

      const status = resolveExitStatus({ code, signal });
      if (status === "failed") {
        sessionLogger.error(
          {
            code,
            event: "session.process.exit.failed",
            session_id: sessionId,
            signal,
          },
          "Agent process exited with failure",
        );
      }
      deps.sessionService.store.remove(sessionId);
      await deps.sessionService.transitionStatus(sessionId, status);
    })
    .catch((err) => {
      sessionLogger.error(
        {
          err,
          event: "session.process.exit_tracking.error",
          session_id: sessionId,
        },
        "Process exit tracking failed",
      );
    });
};
