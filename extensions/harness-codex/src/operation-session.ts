import type { HarnessSession, QuestionResponse } from "@pstdio/sdk/extensions";
import type { createAppServerOperation } from "./app-server-operation";
import type { createAppServerTransport } from "./app-server-transport";
import type { createAsyncQuestionReplies } from "./async-question-replies";
import { questionReplyError } from "./questions";
export const operationSession = (
  id: string,
  operation: ReturnType<typeof createAppServerOperation>,
  asyncQuestions: ReturnType<typeof createAsyncQuestionReplies>,
  rpc: ReturnType<typeof createAppServerTransport>,
) => {
  return {
    agentSessionId: id,
    done: operation.done,
    stop: () => operation.stop(rpc.request, id),
    replyQuestion: (response: QuestionResponse) => {
      if (!asyncQuestions.find(response)) return operation.replyQuestion(response);
      const expectedTurnId = operation.activeTurnId();
      if (!expectedTurnId) return Promise.reject(questionReplyError("Codex question request is no longer pending."));
      return asyncQuestions.reply(response, (text) =>
        rpc.request("turn/steer", {
          threadId: id,
          expectedTurnId,
          input: [{ type: "text", text, text_elements: [] }],
        }),
      );
    },
    timeoutStrategy: "provider",
    pid: rpc.pid,
  } satisfies HarnessSession;
};
