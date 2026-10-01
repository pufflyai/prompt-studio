import type { QuestionResponse } from "pstdio-api-contracts";
import type { SessionsRouteDeps } from "./deps";

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
    return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
  }
};
