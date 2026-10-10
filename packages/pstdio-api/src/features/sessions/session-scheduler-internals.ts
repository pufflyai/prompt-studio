import type { HarnessAttachment, HarnessParams, QuestionResponse, SessionAttachmentRef } from "pstdio-api-contracts";
import type { SessionsRouteDeps } from "./deps";
import { logStartupFailure } from "./session-startup-failure";
import type { ActiveSession } from "./session-store";
import { resumeAgentSession, spawnAgentSession } from "./spawn-agent";

export type ExistingSession = NonNullable<Awaited<ReturnType<SessionsRouteDeps["sessionService"]["get"]>>>;
export type PendingQueueEntry = Awaited<
  ReturnType<SessionsRouteDeps["sessionQueueEntriesService"]["listPending"]>
>[number];

export type StartExistingInput = {
  session: ExistingSession;
  prompt: string;
  cwd?: string;
  agentId?: string;
  model?: string;
  respectCapacity?: boolean;
  questionResponse?: QuestionResponse;
  attachments?: HarnessAttachment[];
  attachmentRefs?: SessionAttachmentRef[];
  params?: HarnessParams;
  signal?: AbortSignal;
};

export type DispatchContext = StartExistingInput & {
  agentId: string;
  switchingAgent: boolean;
  model: string | undefined;
};

const hasAttachmentRefs = (refs: SessionAttachmentRef[] | null | undefined) => (refs?.length ?? 0) > 0;

const projectIdForAgentEnv = (session: ExistingSession) => session.project_id ?? undefined;

let schedulingLock = Promise.resolve();

export const withSchedulingLock = async <T>(operation: () => Promise<T>) => {
  const previous = schedulingLock;
  const { promise, resolve } = Promise.withResolvers<void>();
  schedulingLock = previous.then(() => promise);

  await previous;
  try {
    return await operation();
  } finally {
    resolve();
  }
};

export const hasCreateCapacity = async (deps: SessionsRouteDeps) => {
  const settings = await deps.settingsService.get();
  const limit = settings.max_concurrent_sessions;

  if (limit == null) return true;

  const activeCount = await deps.sessionService.countActive();
  return activeCount < limit;
};

export const updateExistingDispatchSelection = async (
  deps: SessionsRouteDeps,
  input: { session: ExistingSession; agentId: string; model?: string; params?: HarnessParams; switchingAgent: boolean },
) => {
  if (input.switchingAgent) {
    await deps.sessionService.update(input.session.id, {
      agent: input.agentId,
      agent_session_id: null,
      last_selected_model: input.model ?? null,
      params_json: input.params ?? null,
    });
    return;
  }

  if (input.params) {
    await deps.sessionService.update(input.session.id, {
      last_selected_model: input.model ?? input.session.last_selected_model,
      params_json: input.params,
    });
    return;
  }

  if (input.model && input.model !== input.session.last_selected_model) {
    await deps.sessionService.update(input.session.id, { last_selected_model: input.model });
  }
};

export const insertFollowUpEntry = async (
  deps: SessionsRouteDeps,
  input: DispatchContext & { transitionToQueued: boolean },
) => {
  await updateExistingDispatchSelection(deps, input);

  const payload = {
    id: input.session.id,
    prompt: input.prompt,
    request_kind: "follow_up",
    question_response_json: input.questionResponse ?? null,
    attachments_json: input.attachmentRefs,
    params_json: input.params ?? {},
    model: input.model ?? null,
  };

  if (input.transitionToQueued) {
    const { entry } = await deps.sessionService.queueExistingWithEntry(payload);
    return entry?.queue_position ?? null;
  }

  const entry = await deps.sessionService.insertEntryForActive(payload);
  return entry?.queue_position ?? null;
};

export const createSubmittedDispatchEntry = async (
  deps: SessionsRouteDeps,
  input: {
    sessionId: string;
    prompt: string;
    requestKind: "start" | "follow_up";
    questionResponse?: QuestionResponse;
    attachmentRefs?: SessionAttachmentRef[];
    params?: HarnessParams;
  },
) => {
  if (!hasAttachmentRefs(input.attachmentRefs)) return undefined;

  const entry = await deps.sessionQueueEntriesService.createDispatchStarted({
    session_id: input.sessionId,
    prompt: input.prompt,
    request_kind: input.requestKind,
    question_response_json: input.questionResponse ?? null,
    attachments_json: input.attachmentRefs,
    params_json: input.params,
  });

  return entry?.queue_position;
};

export const prepareExistingDispatch = async (deps: SessionsRouteDeps, input: DispatchContext) => {
  const { session, prompt, cwd, agentId, switchingAgent, model, params } = input;

  await updateExistingDispatchSelection(deps, { session, agentId, model: input.model, params, switchingAgent });

  const resumed = await deps.sessionService.resume(session.id, { emitResumedHook: false });
  const dispatchSession = resumed ?? session;
  const submittedQueuePosition = await createSubmittedDispatchEntry(deps, {
    sessionId: session.id,
    prompt,
    requestKind: "follow_up",
    questionResponse: input.questionResponse,
    attachmentRefs: input.attachmentRefs,
    params,
  });

  const fail = (error: unknown, entry: ActiveSession | null) =>
    logStartupFailure(deps, { error, session: dispatchSession, agentId, cwd, model, submittedQueuePosition, entry });

  const emitDispatchHook = () => {
    if (session.last_request_started === null) deps.sessionService.emitStartedHook?.(dispatchSession);
    else deps.sessionService.emitResumedHook?.(dispatchSession);
  };

  return async () => {
    const launch = async (starting: Promise<unknown>) => {
      const owner = deps.sessionService.store.get(session.id);
      if (!input.signal && !input.questionResponse) {
        void starting.catch((error) => fail(error, owner));
        return;
      }
      try {
        await starting;
      } catch (error) {
        if (input.signal?.aborted) {
          if (submittedQueuePosition !== undefined) {
            await deps.sessionQueueEntriesService.remove(submittedQueuePosition);
          }
          await deps.sessionService.cancel(session.id);
        } else {
          await fail(error, owner);
        }
        throw error;
      }
    };

    if (!switchingAgent && session.agent_session_id) {
      await launch(
        resumeAgentSession(
          {
            sessionId: session.id,
            projectId: projectIdForAgentEnv(session),
            agentSessionId: session.agent_session_id,
            agentId,
            prompt,
            attachments: input.attachments,
            model,
            params,
            cwd,
            questionResponse: input.questionResponse,
            submittedQueuePosition,
            signal: input.signal,
          },
          deps,
        ),
      );
      emitDispatchHook();
      return;
    }

    await launch(
      spawnAgentSession(
        {
          sessionId: session.id,
          projectId: projectIdForAgentEnv(session),
          agentId,
          prompt,
          attachments: input.attachments,
          model,
          params,
          cwd,
          submittedQueuePosition,
          signal: input.signal,
        },
        deps,
      ),
    );
    emitDispatchHook();
  };
};
