import type { FollowUpInput, HarnessParams } from "pstdio-api-contracts";
import { createReadBoundary } from "pstdio-extensions";
import { composeSummary } from "./compose-summary";
import type { SessionsRouteDeps } from "./deps";
import { getSessionMessages } from "./get-session-messages";
import { resolveHarnessRunParams } from "./harness-params";
import { QuestionReplyRejectedError, replyToLiveSessionQuestion } from "./live-question-reply";
import { withResolvedSubmittingSessionAttachments } from "./session-attachments";
import { createSessionScheduler } from "./session-scheduler";
import { updateExistingDispatchSelection } from "./session-scheduler-internals";

type ExistingSession = NonNullable<Awaited<ReturnType<SessionsRouteDeps["sessionService"]["get"]>>>;

const buildFollowUpPrompt = async (
  input: {
    prompt?: string;
    summary_from_session_id?: string;
    summary_format?: "brief" | "detailed";
    summary_role?: "assistant" | "all";
  },
  deps: SessionsRouteDeps,
) => {
  let prompt = input.prompt ?? "";

  if (input.summary_from_session_id) {
    const messages = await getSessionMessages(input.summary_from_session_id, deps);
    const summary = composeSummary(messages, {
      format: input.summary_format ?? "brief",
      role: input.summary_role ?? "assistant",
    });

    if (summary) {
      const block = `<session-summary>\n${summary}\n</session-summary>`;
      prompt = prompt ? `${prompt}\n\n${block}` : block;
    }
  }

  return prompt;
};

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
