import type { HarnessSession, QuestionResponse } from "@pstdio/sdk/extensions";
import type { createAppServerOperation } from "./app-server-operation";
import { CodexRequestRejectedError } from "./app-server-rpc";
import type { createAppServerTransport } from "./app-server-transport";
import type { createAsyncQuestionReplies } from "./async-question-replies";
import { questionReplyError } from "./questions";
export const operationSession = (
  id: string,
  operation: ReturnType<typeof createAppServerOperation>,
  asyncQuestions: ReturnType<typeof createAsyncQuestionReplies>,
  rpc: ReturnType<typeof createAppServerTransport>,
  track: <T>(work: Promise<T>) => Promise<T>,
  markUncertain: () => void,
) => {
  return {
    agentSessionId: id,
    done: operation.done,
    stop: () => track(operation.stop(rpc.request, id)),
    replyQuestion: (response: QuestionResponse) =>
      track(
        (async () => {
          if (!asyncQuestions.find(response)) return operation.replyQuestion(response);
          const expectedTurnId = operation.activeTurnId();
          if (!expectedTurnId)
            return Promise.reject(questionReplyError("Codex question request is no longer pending."));
          return asyncQuestions.reply(response, (text) =>
            rpc
              .request("turn/steer", {
                threadId: id,
                expectedTurnId,
                input: [{ type: "text", text, text_elements: [] }],
              })
              .catch((error) => {
                if (!(error instanceof CodexRequestRejectedError)) markUncertain();
                throw error;
              }),
          );
        })(),
      ),
    timeoutStrategy: "provider",
    pid: rpc.pid,
  } satisfies HarnessSession;
};
