import type { HarnessAttachment } from "pstdio-api-contracts";
import type { SessionsRouteDeps } from "./deps";
import { resolveSessionAttachments } from "./session-attachments";
import { type ExistingSession, logStartupFailure, type PendingQueueEntry } from "./session-scheduler-internals";
import { resumeAgentSession, spawnAgentSession, WorkspaceSessionNotReadyError } from "./spawn-agent";

export const dispatchQueuedEntry = async (
  deps: SessionsRouteDeps,
  session: ExistingSession,
  entry: PendingQueueEntry,
) => {
  const agentId = session.agent!;
  const model = session.last_selected_model ?? undefined;
  const cwd = session.cwd ?? undefined;
  const params = entry.params_json ?? session.params_json ?? undefined;
  const dispatchSession = await deps.sessionService.claimQueuedForDispatch(session.id, entry.queue_position);

  if (!dispatchSession) return;

  const submittedQueuePosition = entry.attachments_json?.length ? entry.queue_position : undefined;
  const fail = async (error: unknown) => {
    if (error instanceof WorkspaceSessionNotReadyError && error.retryable) {
      deps.sessionService.store.remove(session.id);
      await deps.sessionService.recoverQueuedDispatchClaim(session.id, entry.queue_position);
      return;
    }
    await deps.sessionQueueEntriesService.remove(entry.queue_position);
    await logStartupFailure(deps, { error, session: dispatchSession, agentId, cwd, model });
  };
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
    return { settled: fail(error) };
  }

  if (entry.request_kind === "start") {
    const settled = spawnAgentSession(
      {
        sessionId: session.id,
        projectId: session.project_id ?? undefined,
        agentId,
        prompt: entry.prompt,
        attachments,
        title: session.title,
        model,
        params,
        cwd,
        submittedQueuePosition,
      },
      deps,
    ).then(removeEntry, fail);
    deps.sessionService.emitStartedHook?.(dispatchSession);
    return { settled };
  }

  if (session.agent_session_id) {
    const settled = resumeAgentSession(
      {
        sessionId: session.id,
        projectId: session.project_id ?? undefined,
        agentSessionId: session.agent_session_id,
        agentId,
        prompt: entry.prompt,
        attachments,
        model,
        params,
        cwd,
        questionResponse: entry.question_response_json as { answers: string[][] } | undefined,
        submittedQueuePosition,
      },
      deps,
    ).then(removeEntry, fail);
    deps.sessionService.emitResumedHook?.(dispatchSession);
    return { settled };
  }

  const settled = spawnAgentSession(
    {
      sessionId: session.id,
      projectId: session.project_id ?? undefined,
      agentId,
      prompt: entry.prompt,
      attachments,
      model,
      params,
      cwd,
      submittedQueuePosition,
    },
    deps,
  ).then(removeEntry, fail);
  deps.sessionService.emitResumedHook?.(dispatchSession);
  return { settled };
};
