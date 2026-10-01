import type { HarnessAttachment, HarnessParams, SessionAttachmentRef } from "pstdio-api-contracts";
import type { ResourceRef } from "pstdio-db";
import type { SessionsRouteDeps } from "./deps";
import { hasPendingProviderQuestion } from "./live-question-reply";
import { createSessionQueueDrain } from "./session-queue-drain";
import { SessionCancellationCleanupError } from "./session-request-cancellation";
import {
  createSubmittedDispatchEntry,
  type DispatchContext,
  type ExistingSession,
  hasCreateCapacity,
  insertFollowUpEntry,
  prepareExistingDispatch,
  type StartExistingInput,
  updateExistingDispatchSelection,
  withSchedulingLock,
} from "./session-scheduler-internals";
import { logStartupFailure } from "./session-startup-failure";
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
  const owner = deps.sessionService.store.get(session.id);
  const fail = (error: unknown) =>
    logStartupFailure(deps, {
      error,
      session,
      agentId: input.agentId,
      cwd: input.cwd,
      model: input.model,
      submittedQueuePosition,
      entry: owner,
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
  const drainQueue = createSessionQueueDrain(deps);

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

  const reserveExistingDispatch = async (input: StartExistingInput) => {
    input.signal?.throwIfAborted();
    // Re-read session status inside the lock so we don't race a terminal transition that landed
    // between endpoint entry and lock acquisition.
    const fresh = (await deps.sessionService.get(input.session.id)) ?? input.session;
    const context = resolveDispatchContext(input, fresh);
    const status = fresh.status;

    // A live run waiting on its own question takes the answer in place: the harness is still
    // attached and finishes the turn with it. Queueing or resuming would start a second run.
    const live = deps.sessionService.store.get(input.session.id);
    if (live?.questionService.hasPending(input.questionResponse?.callId)) {
      input.signal?.throwIfAborted();
      // The answer cannot switch the running agent, but the selection still applies to the next run.
      await updateExistingDispatchSelection(deps, context);
      live.questionService.answer(input.questionResponse ?? input.prompt);
      return { status: "dispatched" } satisfies StartOrQueueResult;
    }

    if (input.questionResponse) {
      input.signal?.throwIfAborted();
      if (
        live?.questionService.hasPending() ||
        status === "queued" ||
        ((status === "in_progress" || status === "awaiting_input") &&
          !(await hasPendingProviderQuestion(live, input.questionResponse)))
      )
        throw new Error("Question request is no longer pending.");
      return prepareExistingDispatch(deps, context);
    }

    if (status === "in_progress" || status === "awaiting_input") {
      return insertAbortAwareFollowUp(deps, context, false);
    }

    if (status === "queued") return insertAbortAwareFollowUp(deps, context, false);
    if (input.respectCapacity && !(await hasCreateCapacity(deps))) {
      return insertAbortAwareFollowUp(deps, context, true);
    }

    input.signal?.throwIfAborted();
    return prepareExistingDispatch(deps, context);
  };

  const startOrQueueExisting = async (input: StartExistingInput): Promise<StartOrQueueResult> => {
    const result = await withSchedulingLock(() => reserveExistingDispatch(input));
    if (typeof result !== "function") return result;
    await result();
    return { status: "dispatched" };
  };

  const resumeForApproval = async (sessionId: string) => {
    return deps.sessionService.resume(sessionId);
  };

  const recoverQueuedSessions = async () => {
    const claimedEntries = await deps.sessionQueueEntriesService.listDispatchStarted();
    for (const entry of claimedEntries) {
      const session = await deps.sessionService.get(entry.session_id);
      if (session?.status === "in_progress" && !deps.sessionService.store.get(session.id)) {
        await deps.sessionService.recoverQueuedDispatchClaim(
          session.id,
          entry.queue_position,
          session.last_request_started,
        );
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
