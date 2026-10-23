import type { FollowUpInput, HarnessParams } from "pstdio-api-contracts";
import { createReadBoundary } from "pstdio-extensions";
import type { SessionsRouteDeps } from "./deps";
import { buildFollowUpPrompt } from "./follow-up-prompt";
import { resolveHarnessRunParams } from "./harness-params";
import { QuestionReplyRejectedError, replyToLiveSessionQuestion } from "./live-question-reply";
import { withResolvedSubmittingSessionAttachments } from "./session-attachments";
import { createSessionScheduler } from "./session-scheduler";
import { updateExistingDispatchSelection } from "./session-scheduler-internals";

type ExistingSession = NonNullable<Awaited<ReturnType<SessionsRouteDeps["sessionService"]["get"]>>>;

const resolveFollowUpParams = async (
  deps: SessionsRouteDeps,
  session: ExistingSession,
  input: { agent?: string; model?: string; params?: HarnessParams },
) => {
  const agentId = input.agent ?? session.agent;
  if (!agentId) return undefined;

  const sameAgent = agentId === session.agent;
  const model = input.model?.trim() || (sameAgent ? (session.last_selected_model ?? undefined) : undefined);

  const params = await resolveHarnessRunParams(deps, {
    projectId: session.project_id ?? undefined,
    agentId,
    model,
    persistedOverrides: sameAgent ? (session.params_json ?? undefined) : undefined,
    overrides: input.params,
  });
  return params ?? (sameAgent && session.params_json ? {} : undefined);
};

export const sendSessionFollowUp = async (
  deps: SessionsRouteDeps,
  session: ExistingSession,
  input: FollowUpInput,
  options: {
    signal?: AbortSignal;
    expectedRun?: { status: string; startedAt: string | null; endedAt: string | null };
  } = {},
) => {
  const read = createReadBoundary(options.signal);
  const params = await read(() => resolveFollowUpParams(deps, session, input));
  if (options.expectedRun) {
    const current = await read(() => deps.sessionService.get(session.id));
    if (
      !current ||
      current.status !== options.expectedRun.status ||
      current.last_request_started !== options.expectedRun.startedAt ||
      current.last_request_ended !== options.expectedRun.endedAt
    )
      throw new Error("Session execution changed before continuation.");
  }
  const reply = await replyToLiveSessionQuestion(deps, session.id, input.question_response, input.attachments);
  if (reply) {
    if (!reply.ok) throw new QuestionReplyRejectedError(reply.error);
    options.signal?.throwIfAborted();
    await updateExistingDispatchSelection(deps, {
      session,
      agentId: input.agent ?? session.agent!,
      model: input.model?.trim() || undefined,
      params,
      switchingAgent: Boolean(input.agent && input.agent !== session.agent),
    });
    return { status: "dispatched" as const };
  }
  const prompt = await read(() => buildFollowUpPrompt(input, deps));
  return withResolvedSubmittingSessionAttachments(deps, session.project_id!, input.attachments, async (attachments) => {
    options.signal?.throwIfAborted();
    return createSessionScheduler(deps).startOrQueueExisting({
      session,
      prompt,
      cwd: session.cwd ?? undefined,
      agentId: input.agent,
      model: input.model?.trim() || undefined,
      params,
      respectCapacity: true,
      questionResponse: input.question_response,
      attachments,
      attachmentRefs: input.attachments,
      signal: options.signal,
      ...(options.expectedRun ? { expectedRun: { ...options.expectedRun, status: session.status } } : {}),
    });
  });
};
