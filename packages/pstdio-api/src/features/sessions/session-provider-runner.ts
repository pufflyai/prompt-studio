import type {
  HarnessApprovalRequest,
  HarnessQuestionResponse,
  HarnessSessionMessageInput,
  HarnessSessionMessagesInput,
  HarnessSessionStartInput,
  HarnessSpawnedProcess,
} from "@pstdio/sdk/extensions";
import type { SessionMessage } from "pstdio-agents";
import { sessionLogger } from "../../lib/logger";
import type { RouteDeps } from "../deps";
import { persistSessionMessages } from "./session-messages";

export type SessionProvider = {
  startSession(input: HarnessSessionStartInput): Promise<{ sessionId: string; process?: HarnessSpawnedProcess }>;
  resumeSession(
    input: HarnessSessionMessageInput,
    eventStore: ProviderSessionStore["eventStore"],
    approvalService?: ProviderSessionStore["approvalService"],
  ): Promise<{ process?: HarnessSpawnedProcess }>;
  reattachSession?(
    input: { sessionId: string; cwd?: string },
    eventStore: ProviderSessionStore["eventStore"],
  ): Promise<{ process?: HarnessSpawnedProcess }>;
  getMessages(sessionId: string, input?: HarnessSessionMessagesInput): Promise<SessionMessage[]>;
};

type ProviderSessionStore = ReturnType<RouteDeps["sessionService"]["store"]["create"]>;

export type ProviderSpawnDeps = Pick<RouteDeps, "eventBus" | "fileService" | "sessionService"> & {
  processExitTimeoutMs?: number;
};

export type ProviderSpawnInput = {
  sessionId: string;
  prompt: string;
  title?: string;
  model?: string;
  cwd?: string;
  provider: SessionProvider;
};

export type ProviderResumeInput = {
  sessionId: string;
  agentSessionId: string;
  prompt: string;
  model?: string;
  cwd?: string;
  messageOffset?: number;
  questionResponse?: HarnessQuestionResponse;
  provider: SessionProvider;
};

export type ProviderReattachInput = {
  sessionId: string;
  agentSessionId: string;
  cwd?: string;
  providerId: string;
  provider: SessionProvider;
};

const DEFAULT_PROCESS_EXIT_TIMEOUT_MS = 10 * 60 * 1000;
type TrackedExitStatus = "disconnected" | "cancelled" | "completed" | "failed";

const resolveExitStatus = (exit: { code: number | null; signal: string | null }): TrackedExitStatus => {
  if (exit.signal === "TIMEOUT") return "disconnected";
  if (exit.signal === "SIGTERM" || exit.signal === "SIGINT") return "cancelled";
  return exit.code === 0 ? "completed" : "failed";
};

const withProcessExitTimeout = (
  sessionId: string,
  process: Pick<HarnessSpawnedProcess, "kill" | "onExit">,
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
      if (timer) clearTimeout(timer);
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
      if (timer) clearTimeout(timer);
      timer = setTimeout(killProcess, timeoutMs);
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
      if (timer) clearTimeout(timer);
      void activityIterator.return?.();
      reject(error);
    });
  });

export const spawnProviderSession = async (input: ProviderSpawnInput, deps: ProviderSpawnDeps) => {
  const entry = deps.sessionService.store.create(input.sessionId, (request: HarnessApprovalRequest) => {
    entry.eventStore.push({ op: "add", path: "/approval_request", value: request });
  });

  const result = await input.provider.startSession({
    prompt: input.prompt,
    title: input.title,
    model: input.model,
    cwd: input.cwd,
    env: { PSTDIO_SESSION_ID: input.sessionId },
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

export const resumeProviderSession = async (input: ProviderResumeInput, deps: ProviderSpawnDeps) => {
  const entry = deps.sessionService.store.create(input.sessionId, (request: HarnessApprovalRequest) => {
    entry.eventStore.push({ op: "add", path: "/approval_request", value: request });
  });

  let messageOffset = input.messageOffset;
  if (messageOffset === undefined) {
    try {
      const messages = await input.provider.getMessages(
        input.agentSessionId,
        input.cwd ? { cwd: input.cwd } : undefined,
      );
      messageOffset = messages.length;
    } catch {
      messageOffset = 0;
    }
  }

  const result = await input.provider.resumeSession(
    {
      sessionId: input.agentSessionId,
      prompt: input.prompt,
      model: input.model,
      cwd: input.cwd,
      env: { PSTDIO_SESSION_ID: input.sessionId },
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

export const reattachProviderSession = async (input: ProviderReattachInput, deps: ProviderSpawnDeps) => {
  if (!input.provider.reattachSession) throw new Error(`Harness does not support reattach: ${input.providerId}`);
  const entry = deps.sessionService.store.create(input.sessionId, (request: HarnessApprovalRequest) => {
    entry.eventStore.push({ op: "add", path: "/approval_request", value: request });
  });

  const result = await input.provider.reattachSession(
    { sessionId: input.agentSessionId, cwd: input.cwd },
    entry.eventStore,
  );

  if (result.process) {
    deps.sessionService.store.setProcess(input.sessionId, result.process);
    trackProcessLifecycle(input.sessionId, result.process, entry.eventStore.subscribe(), deps);
  }

  return result;
};

const trackProcessLifecycle = (
  sessionId: string,
  process: Pick<HarnessSpawnedProcess, "kill" | "onExit" | "timeoutStrategy">,
  activity: AsyncIterable<unknown>,
  deps: ProviderSpawnDeps,
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
      await deps.sessionService.transitionStatus(sessionId, status);
      deps.sessionService.store.remove(sessionId);
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
