import type { HarnessAttachment, SessionAttachmentRef } from "pstdio-api-contracts";
import { sessionLogger } from "../../lib/logger";
import type { SessionsRouteDeps } from "./deps";
import { resolveSessionAttachments } from "./session-attachments";
import { resumeAgentSession, spawnAgentSession } from "./spawn-agent";

export type ExistingSession = NonNullable<Awaited<ReturnType<SessionsRouteDeps["sessionService"]["get"]>>>;
export type PendingQueueEntry = Awaited<
  ReturnType<SessionsRouteDeps["sessionQueueEntriesService"]["listPending"]>
>[number];

export type StartExistingInput = {
  session: ExistingSession;
  prompt: string;
  cwd: string;
  agentId?: string;
  model?: string;
  respectCapacity?: boolean;
  questionResponse?: { answers: string[][] };
  attachments?: HarnessAttachment[];
  attachmentRefs?: SessionAttachmentRef[];
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

export const logStartupFailure = async (
  deps: SessionsRouteDeps,
  input: {
    error: unknown;
    session: ExistingSession;
    agentId: string;
    cwd?: string;
    model?: string;
    submittedQueuePosition?: number;
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
  if (input.submittedQueuePosition !== undefined) {
    await deps.sessionQueueEntriesService.remove(input.submittedQueuePosition);
  }
  deps.sessionService.store.remove(input.session.id);
  await deps.sessionService.transitionStatus(input.session.id, "failed");
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
  input: { session: ExistingSession; agentId: string; model?: string; switchingAgent: boolean },
) => {
  if (input.switchingAgent) {
    await deps.sessionService.update(input.session.id, {
      agent: input.agentId,
      agent_session_id: null,
      last_selected_model: input.model ?? null,
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
    questionResponse?: { answers: string[][] };
    attachmentRefs?: SessionAttachmentRef[];
  },
) => {
  if (!hasAttachmentRefs(input.attachmentRefs)) return undefined;

  const entry = await deps.sessionQueueEntriesService.createDispatchStarted({
    session_id: input.sessionId,
    prompt: input.prompt,
    request_kind: input.requestKind,
    question_response_json: input.questionResponse ?? null,
    attachments_json: input.attachmentRefs,
  });

  return entry?.queue_position;
};

export const dispatchQueuedEntry = async (
  deps: SessionsRouteDeps,
  session: ExistingSession,
  entry: PendingQueueEntry,
) => {
  const agentId = session.agent!;
  const model = session.last_selected_model ?? undefined;
  const cwd = session.cwd ?? undefined;
  const dispatchSession = await deps.sessionService.claimQueuedForDispatch(session.id, entry.queue_position);

  if (!dispatchSession) return;

  const submittedQueuePosition = hasAttachmentRefs(entry.attachments_json) ? entry.queue_position : undefined;
  const fail = (error: unknown) =>
    logStartupFailure(deps, { error, session: dispatchSession, agentId, cwd, model, submittedQueuePosition });
  const removeEntry = () =>
    submittedQueuePosition === undefined ? deps.sessionQueueEntriesService.remove(entry.queue_position) : undefined;

  let attachments: HarnessAttachment[];
  try {
    attachments = await resolveSessionAttachments(deps, session.project_id!, entry.attachments_json ?? []);
  } catch (error) {
    // A corrupted attachment ref must fail only this entry, not abort the whole drain loop.
    // fail() transitions to "failed" which re-enters the scheduling lock via the capacity-release
    // drain, so it runs detached rather than awaited to avoid deadlocking the current drain.
    await removeEntry();
    void fail(error);
    return;
  }

  if (entry.request_kind === "start") {
    spawnAgentSession(
      {
        sessionId: session.id,
        projectId: projectIdForAgentEnv(session),
        agentId,
        prompt: entry.prompt,
        attachments,
        title: session.title,
        model,
        cwd,
        submittedQueuePosition,
      },
      deps,
    ).catch(fail);
    await removeEntry();
    deps.sessionService.emitStartedHook?.(dispatchSession);
    return;
  }

  if (session.agent_session_id) {
    resumeAgentSession(
      {
        sessionId: session.id,
        projectId: projectIdForAgentEnv(session),
        agentSessionId: session.agent_session_id,
        agentId,
        prompt: entry.prompt,
        attachments,
        model,
        cwd: cwd ?? "",
        questionResponse: entry.question_response_json as { answers: string[][] } | undefined,
        submittedQueuePosition,
      },
      deps,
    ).catch(fail);
    await removeEntry();
    deps.sessionService.emitResumedHook?.(dispatchSession);
    return;
  }

  spawnAgentSession(
    {
      sessionId: session.id,
      projectId: projectIdForAgentEnv(session),
      agentId,
      prompt: entry.prompt,
      attachments,
      model,
      cwd,
      submittedQueuePosition,
    },
    deps,
  ).catch(fail);
  await removeEntry();
  deps.sessionService.emitResumedHook?.(dispatchSession);
};

export const dispatchExisting = async (deps: SessionsRouteDeps, input: DispatchContext) => {
  const { session, prompt, cwd, agentId, switchingAgent, model } = input;

  await updateExistingDispatchSelection(deps, { session, agentId, model: input.model, switchingAgent });

  const resumed = await deps.sessionService.resume(session.id, { emitResumedHook: false });
  const dispatchSession = resumed ?? session;
  const submittedQueuePosition = await createSubmittedDispatchEntry(deps, {
    sessionId: session.id,
    prompt,
    requestKind: "follow_up",
    questionResponse: input.questionResponse,
    attachmentRefs: input.attachmentRefs,
  });

  const fail = (error: unknown) =>
    logStartupFailure(deps, { error, session: dispatchSession, agentId, cwd, model, submittedQueuePosition });

  if (!switchingAgent && session.agent_session_id) {
    resumeAgentSession(
      {
        sessionId: session.id,
        projectId: projectIdForAgentEnv(session),
        agentSessionId: session.agent_session_id,
        agentId,
        prompt,
        attachments: input.attachments,
        model,
        cwd,
        questionResponse: input.questionResponse,
        submittedQueuePosition,
      },
      deps,
    ).catch(fail);
    deps.sessionService.emitResumedHook?.(dispatchSession);
    return;
  }

  spawnAgentSession(
    {
      sessionId: session.id,
      projectId: projectIdForAgentEnv(session),
      agentId,
      prompt,
      attachments: input.attachments,
      model,
      cwd,
      submittedQueuePosition,
    },
    deps,
  ).catch(fail);
  deps.sessionService.emitResumedHook?.(dispatchSession);
};
