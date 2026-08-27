import { sessionLogger } from "../../lib/logger";
import type { SessionsRouteDeps } from "./deps";
import { getSessionHarness } from "./get-session-harness";
import { reattachAgentSession } from "./spawn-agent";

type Deps = Pick<
  SessionsRouteDeps,
  | "sessionService"
  | "harnessRegistry"
  | "eventBus"
  | "fileService"
  | "sessionQueueEntriesService"
  | "workspaceSessionService"
>;

const removeDispatchStartedEntriesForSession = async (deps: Deps, sessionId: string) => {
  const entries = await deps.sessionQueueEntriesService.listDispatchStarted();
  for (const entry of entries) {
    if (entry.session_id === sessionId) await deps.sessionQueueEntriesService.remove(entry.queue_position);
  }
};

const getDispatchStartedEntryForSession = async (deps: Deps, sessionId: string) => {
  const entries = await deps.sessionQueueEntriesService.listDispatchStarted();
  return entries.find((entry) => entry.session_id === sessionId);
};

type OrphanedSession = Awaited<ReturnType<Deps["sessionService"]["listByStatus"]>>[number];

class RetryableSessionReattachError extends Error {
  readonly retryable = true;

  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
  }
}

const isRetryableReattachError = (error: unknown) =>
  typeof error === "object" && error !== null && "retryable" in error && error.retryable === true;

const waitForReattachRetry = (delayMs: number, signal?: AbortSignal) =>
  new Promise<boolean>((resolve) => {
    const finish = (shouldRetry: boolean) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      resolve(shouldRetry);
    };
    const onAbort = () => finish(false);
    const timer = setTimeout(() => finish(true), delayMs);
    if (signal?.aborted) onAbort();
    else signal?.addEventListener("abort", onAbort, { once: true });
  });

const reattachOrphanedSession = async (deps: Deps, session: OrphanedSession, signal?: AbortSignal) => {
  let retryDelayMs = 250;
  while (!signal?.aborted) {
    try {
      const dispatchEntry = await getDispatchStartedEntryForSession(deps, session.id).catch((error) => {
        throw new RetryableSessionReattachError(error);
      });
      await reattachAgentSession(
        {
          sessionId: session.id,
          projectId: session.project_id ?? undefined,
          agentSessionId: session.agent_session_id!,
          agentId: session.agent!,
          cwd: session.cwd ?? undefined,
          submittedAttachmentFileIds: dispatchEntry?.attachments_json?.map((attachment) => attachment.file_id),
          submittedQueuePosition: dispatchEntry?.queue_position,
          signal,
        },
        deps,
      );
      return;
    } catch (error) {
      deps.sessionService.store.remove(session.id);
      if (signal?.aborted) return;
      if (!isRetryableReattachError(error)) throw error;
      sessionLogger.warn(
        { err: error, event: "session.reattach.failed", retry_delay_ms: retryDelayMs, session_id: session.id },
        "Failed to reattach orphaned session; retrying",
      );
      if (!(await waitForReattachRetry(retryDelayMs, signal))) return;
      retryDelayMs = Math.min(retryDelayMs * 2, 30_000);
    }
  }
};

const resolveOrphanedSession = async (deps: Deps, session: OrphanedSession, signal?: AbortSignal) => {
  if (signal?.aborted || deps.sessionService.store.get(session.id)) return;

  const harness = await getSessionHarness(deps.harnessRegistry, session);
  const canReattach =
    harness?.supportsReattach &&
    (await harness.capabilities({ projectId: session.project_id ?? undefined })).includes("SessionReattach") &&
    session.agent_session_id;

  if (!canReattach) {
    await deps.sessionService.transitionStatus(session.id, "disconnected");
    return;
  }

  try {
    await reattachOrphanedSession(deps, session, signal);
  } catch (err) {
    sessionLogger.warn(
      { err, event: "session.reattach.permanent_failure", session_id: session.id },
      "Failed to reattach orphaned session permanently; marking it disconnected",
    );
    deps.sessionService.store.remove(session.id);
    await removeDispatchStartedEntriesForSession(deps, session.id);
    await deps.sessionService.transitionStatus(session.id, "disconnected");
  }
};

export const resolveOrphanedSessions = async (deps: Deps, signal?: AbortSignal) => {
  const staleSessions = await deps.sessionService.listByStatus("in_progress");
  await Promise.all(staleSessions.map((session) => resolveOrphanedSession(deps, session, signal)));
};
