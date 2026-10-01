import type { QuestionResponse } from "pstdio-api-contracts";
import type { SessionsRouteDeps } from "./deps";
import type { ActiveSession } from "./session-store";

export class QuestionReplyRejectedError extends Error {
  readonly questionRejected = true;
}

export const questionReplyRejection = (error: unknown) =>
  error instanceof Error && "questionRejected" in error && error.questionRejected === true ? error : undefined;

export const hasPendingProviderQuestion = async (entry: ActiveSession | null, response: QuestionResponse) => {
  if (!entry) return false;
  const conversation = await entry.conversationReady;
  return conversation
    .getMessages()
    .some((message) =>
      message.parts.some(
        (part) =>
          part.type === "tool" &&
          part.tool === "question" &&
          (part.status === "pending" || part.status === "running") &&
          (!response.callId || part.callId === response.callId),
      ),
    );
};

export const validateRecoveredQuestionReply = async (
  status: string,
  owner: ActiveSession | null,
  response: QuestionResponse,
) => {
  const requiresPendingQuestion = status === "in_progress" || (status === "awaiting_input" && owner);
  if (
    owner?.questionService.hasPending() ||
    status === "queued" ||
    (requiresPendingQuestion && !(await hasPendingProviderQuestion(owner, response)))
  )
    throw new QuestionReplyRejectedError("Question request is no longer pending.");
};

export const replyToLiveSessionQuestion = async (
  deps: SessionsRouteDeps,
  sessionId: string,
  response: QuestionResponse | undefined,
) => {
  const entry = deps.sessionService.store.get(sessionId);
  const session = entry?.session;
  if (!response || !session?.replyQuestion || entry?.questionService.hasPending(response.callId)) return undefined;
  try {
    await session.replyQuestion(response);
    return { ok: true as const };
  } catch (error) {
    const rejection = questionReplyRejection(error);
    if (!rejection) throw error;
    return { ok: false as const, error: rejection.message };
  }
};
