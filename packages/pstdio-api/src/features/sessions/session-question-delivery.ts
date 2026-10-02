import type { QuestionResponse } from "pstdio-api-contracts";
import { QuestionReplyRejectedError } from "./live-question-reply";
import type { ActiveSession } from "./session-store";

// Subscribe before delivery so a fast tool result cannot race past confirmation.
// The caller waits outside the scheduling lock, allowing cancellation and other runs to proceed.
export const prepareHostQuestionDelivery = async (owner: ActiveSession, response?: QuestionResponse) => {
  const conversation = await owner.conversationReady;
  const { messages, stream } = conversation.snapshotAndSubscribe();
  const iterator = stream[Symbol.asyncIterator]();
  const callIds = new Set(
    messages.flatMap((message) =>
      message.parts.flatMap((part) =>
        part.type === "tool" &&
        part.tool === "question" &&
        (part.status === "pending" || part.status === "running") &&
        (!response?.callId || part.callId === response.callId) &&
        owner.questionService.hasPending(part.callId)
          ? [part.callId]
          : [],
      ),
    ),
  );
  // The public question channel also supports harnesses without a tool part to confirm.
  if (callIds.size === 0) await iterator.return?.();
  return async () => {
    try {
      while (
        conversation
          .getMessages()
          .some((message) =>
            message.parts.some(
              (part) =>
                part.type === "tool" &&
                callIds.has(part.callId) &&
                (part.status === "pending" || part.status === "running"),
            ),
          )
      ) {
        if ((await iterator.next()).done)
          throw new QuestionReplyRejectedError("Question request is no longer pending.");
      }
      if (owner.cancellationRequested) throw new QuestionReplyRejectedError("Question request is no longer pending.");
    } finally {
      await iterator.return?.();
    }
  };
};
