import type { QuestionResponse } from "pstdio-api-contracts";
import type { SessionsRouteDeps } from "./deps";

export const replyToLiveSessionQuestion = async (
  deps: SessionsRouteDeps,
  sessionId: string,
  response: QuestionResponse | undefined,
) => {
  const session = deps.sessionService.store.get(sessionId)?.session;
  if (!response || !session?.replyQuestion) return undefined;
  try {
    await session.replyQuestion(response);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
  }
};
