import type { HarnessAttachment, HarnessParams, SessionAttachmentRef } from "pstdio-api-contracts";
import type { ResourceRef } from "pstdio-db";
import type { SessionsRouteDeps } from "./deps";
import { getSessionHarness } from "./get-session-harness";
import { SessionCancellationCleanupError } from "./session-request-cancellation";
import {
  createSubmittedDispatchEntry,
  type DispatchContext,
  dispatchExisting,
  dispatchQueuedEntry,
  type ExistingSession,
  hasCreateCapacity,
  insertFollowUpEntry,
  logStartupFailure,
  type StartExistingInput,
  withSchedulingLock,
} from "./session-scheduler-internals";
import { spawnAgentSession } from "./spawn-agent";

type CreateAndStartInput = {
  projectId: string;
  title: string;
  agentId: string;
  prompt: string;
  attachments?: HarnessAttachment[];
  attachmentRefs?: SessionAttachmentRef[];
  model?: string;
  params?: HarnessParams;
  originalSessionId?: string;
  cwd?: string;
  anchors?: ResourceRef[];
  onBeforeStartedHook?: (session: ExistingSession) => Promise<void>;
  signal?: AbortSignal;
};

export type StartOrQueueResult = { status: "dispatched" } | { status: "queued"; queue_position: number };

const queuedResult = (queuePosition: number | null): StartOrQueueResult =>
  queuePosition != null ? { status: "queued", queue_position: queuePosition } : { status: "dispatched" };

const insertAbortAwareFollowUp = async (
  deps: SessionsRouteDeps,
  context: DispatchContext,
  transitionToQueued: boolean,
) => {
  context.signal?.throwIfAborted();
  const queuePosition = await insertFollowUpEntry(deps, { ...context, transitionToQueued });
  if (context.signal?.aborted) {
    if (queuePosition !== null) await deps.sessionQueueEntriesService.remove(queuePosition);
    context.signal.throwIfAborted();
  }
  return queuedResult(queuePosition);
};

const isTerminal = (status: string) =>
  status === "completed" || status === "failed" || status === "cancelled" || status === "disconnected";

const runBeforeStartedHook = async (
  deps: SessionsRouteDeps,
  session: ExistingSession,
  hook: CreateAndStartInput["onBeforeStartedHook"],
  cleanup: { drainAfterLock: boolean },
) => {
  try {
    await hook?.(session);
  } catch (error) {
    if (session.status === "queued") {
      await deps.sessionService.cancel(session.id);
    } else {
      await deps.sessionService.transitionStatus(session.id, "failed", { drainCapacity: false });
      cleanup.drainAfterLock = true;
    }
    throw error;
  }
};

const resolveDispatchContext = (input: StartExistingInput, fresh: ExistingSession): DispatchContext => {
  const agentId = input.agentId ?? fresh.agent!;
  const switchingAgent = input.agentId != null && input.agentId !== fresh.agent;
  const model = input.model ?? (switchingAgent ? undefined : (fresh.last_selected_model ?? undefined));
  return { ...input, session: fresh, agentId, switchingAgent, model };
};

const startScheduledSession = async (
  deps: SessionsRouteDeps,
  input: CreateAndStartInput,
  session: ExistingSession,
  submittedQueuePosition?: number,
) => {
  if (input.signal?.aborted) {
    if (submittedQueuePosition !== undefined) await deps.sessionQueueEntriesService.remove(submittedQueuePosition);
    await deps.sessionService.cancel(session.id);
    input.signal.throwIfAborted();
  }

  const spawning = spawnAgentSession(
    {
      sessionId: session.id,
      projectId: input.projectId,
      agentId: input.agentId,
      prompt: input.prompt,
      attachments: input.attachments,
      title: input.title,
      model: input.model,
      params: input.params,
      cwd: input.cwd,
      submittedQueuePosition,
      signal: input.signal,
    },
    deps,
  );
  const fail = (error: unknown) =>
    logStartupFailure(deps, {
      error,
      session,
      agentId: input.agentId,
      cwd: input.cwd,
      model: input.model,
      submittedQueuePosition,
    });
  if (!input.signal) {
    void spawning.catch(fail);
    return;
  }

  try {
    await spawning;
  } catch (error) {
    if (error instanceof SessionCancellationCleanupError) throw error;
    if (input.signal.aborted) {
      if (submittedQueuePosition !== undefined) await deps.sessionQueueEntriesService.remove(submittedQueuePosition);
      await deps.sessionService.cancel(session.id);
      input.signal.throwIfAborted();
    }
    await fail(error);
    throw error;
  }
};

export const createSessionScheduler = (deps: SessionsRouteDeps) => {
  const canReattachActiveSession = async (session: ExistingSession) => {
    if (!session.agent || !session.agent_session_id) return false;

    const harness = await getSessionHarness(deps.harnessRegistry, session);
    return Boolean(
      harness?.supportsReattach &&
        (await harness.capabilities({ projectId: session.project_id ?? undefined })).includes("SessionReattach"),
    );
  };

  const maybeRequeueReleasedSession = async (sessionId: string) => {
    const session = await deps.sessionService.get(sessionId);
    if (!session || !isTerminal(session.status)) return;

    if (session.status === "cancelled") {
      await deps.sessionQueueEntriesService.removeBySession(sessionId);
      return;
    }

    const pending = await deps.sessionQueueEntriesService.listPendingBySession(sessionId);
    if (pending.length === 0) return;

    await deps.sessionService.requeueAfterTerminal(sessionId);
  };

  const drainQueue = async (input?: { releasedSessionId?: string }) => {
    return withSchedulingLock(async () => {
      if (input?.releasedSessionId) {
        await maybeRequeueReleasedSession(input.releasedSessionId);
      }

      const pending = await deps.sessionQueueEntriesService.listPending();
      for (const entry of pending) {
        if (!(await hasCreateCapacity(deps))) return;

        const session = await deps.sessionService.get(entry.session_id);
        if (!session || session.status !== "queued") {
          // Pending entries can coexist with non-queued sessions (multi-pending follow-ups).
          // Skip without side-effect; markDispatchStarted would permanently orphan the entry.
          continue;
        }

        await dispatchQueuedEntry(deps, session, entry);
      }
    });
  };

  const createAndStartSession = async (input: CreateAndStartInput) => {
    input.signal?.throwIfAborted();
    const cleanup = { drainAfterLock: false };
    let scheduled!: { session: ExistingSession; shouldStart: boolean; submittedQueuePosition?: number };

    try {
      scheduled = await withSchedulingLock(async () => {
        input.signal?.throwIfAborted();
        const hasCapacity = await hasCreateCapacity(deps);

        if (!hasCapacity) {
          const queued = await deps.sessionService.createQueuedWithEntry(
            {
              project_id: input.projectId,
              title: input.title,
              agent: input.agentId,
              last_selected_model: input.model,
              original_session_id: input.originalSessionId,
              cwd: input.cwd,
              anchors: input.anchors,
              params_json: input.params,
              prompt: input.prompt,
              attachments_json: input.attachmentRefs,
              request_kind: "start",
            },
            { emitStartedHook: false },
          );
          await runBeforeStartedHook(deps, queued, input.onBeforeStartedHook, cleanup);
          if (input.signal?.aborted) {
            await deps.sessionService.cancel(queued.id);
            input.signal.throwIfAborted();
          }

          return { session: queued, shouldStart: false };
        }

        const started = await deps.sessionService.create(
          {
            project_id: input.projectId,
            title: input.title,
            agent: input.agentId,
            last_selected_model: input.model,
            original_session_id: input.originalSessionId,
            cwd: input.cwd,
            anchors: input.anchors,
            params_json: input.params,
          },
          { emitStartedHook: false },
        );
        await runBeforeStartedHook(deps, started, input.onBeforeStartedHook, cleanup);
        if (input.signal?.aborted) {
          await deps.sessionService.cancel(started.id);
          input.signal.throwIfAborted();
        }
        const submittedQueuePosition = await createSubmittedDispatchEntry(deps, {
          sessionId: started.id,
          prompt: input.prompt,
          requestKind: "start",
          attachmentRefs: input.attachmentRefs,
          params: input.params,
        });

        return { session: started, shouldStart: true, submittedQueuePosition };
      });
    } catch (error) {
      if (cleanup.drainAfterLock) {
        await drainQueue();
      }
      throw error;
    }

    const { session, shouldStart, submittedQueuePosition } = scheduled;

    if (!shouldStart) {
      return session;
    }

    await startScheduledSession(deps, input, session, submittedQueuePosition);
    deps.sessionService.emitStartedHook?.(session);

    return session;
  };

  const startOrQueueExisting = async (input: StartExistingInput): Promise<StartOrQueueResult> => {
    return withSchedulingLock(async () => {
      input.signal?.throwIfAborted();
      // Re-read session status inside the lock so we don't race a terminal transition that landed
      // between endpoint entry and lock acquisition.
      const fresh = (await deps.sessionService.get(input.session.id)) ?? input.session;
      const context = resolveDispatchContext(input, fresh);
      const status = fresh.status;
      const fastPathQuestion = status === "awaiting_input" && input.questionResponse != null;

      if (fastPathQuestion) {
        input.signal?.throwIfAborted();
        await dispatchExisting(deps, context);
        return { status: "dispatched" } as const;
      }

      if (status === "in_progress" || status === "awaiting_input" || status === "queued") {
        return insertAbortAwareFollowUp(deps, context, false);
      }

      if (input.respectCapacity && !(await hasCreateCapacity(deps))) {
        return insertAbortAwareFollowUp(deps, context, true);
      }

      input.signal?.throwIfAborted();
      await dispatchExisting(deps, context);
      return { status: "dispatched" } as const;
    });
  };

  const resumeForApproval = async (sessionId: string) => {
    return deps.sessionService.resume(sessionId);
  };

  const recoverQueuedSessions = async () => {
    const claimedEntries = await deps.sessionQueueEntriesService.listDispatchStarted();
    for (const entry of claimedEntries) {
      const session = await deps.sessionService.get(entry.session_id);
      if (session?.status === "in_progress" && !deps.sessionService.store.get(session.id)) {
        if (await canReattachActiveSession(session)) continue;
        await deps.sessionService.recoverQueuedDispatchClaim(session.id, entry.queue_position);
      }
    }

    await drainQueue();
  };

  return {
    createAndStartSession,
    startOrQueueExisting,
    resumeForApproval,
    drainQueue,
    recoverQueuedSessions,
  };
};
