import type { QuestionResponse } from "pstdio-api-contracts";
import type { SessionsRouteDeps } from "./deps";
import { getSessionHistory } from "./session-history";
import type { ActiveSession } from "./session-store";

export class QuestionReplyRejectedError extends Error {
  readonly questionRejected = true;
}

// An answer reaches the agent as its tool result, which has no place for a file. Refusing it keeps
// the files with the person instead of answering without them.
export const ANSWER_WITH_FILES_ERROR =
  "An answer to a question cannot include files. Answer first, then send the files in a new message.";

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
  deps: SessionsRouteDeps,
  sessionId: string,
  status: string,
  owner: ActiveSession | null,
  response: QuestionResponse,
) => {
  if (response.callId) {
    const messages = await getSessionHistory(sessionId, deps);
    const answered = messages.some((message) =>
      message.parts.some(
        (part) =>
          part.type === "tool" &&
          part.tool === "question" &&
          part.callId === response.callId &&
          part.status !== "pending" &&
          part.status !== "running",
      ),
    );
    if (answered) throw new QuestionReplyRejectedError("Question request is no longer pending.");
  }
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
  attachments: readonly unknown[] | undefined,
) => {
  const entry = deps.sessionService.store.get(sessionId);
  const session = entry?.session;
  if (!response || !session?.replyQuestion || entry?.questionService.hasPending(response.callId)) return undefined;
  if (attachments?.length) return { ok: false as const, error: ANSWER_WITH_FILES_ERROR };
  try {
    await session.replyQuestion(response);
    return { ok: true as const };
  } catch (error) {
    const rejection = questionReplyRejection(error);
    if (!rejection) throw error;
    return { ok: false as const, error: rejection.message };
  }
};
