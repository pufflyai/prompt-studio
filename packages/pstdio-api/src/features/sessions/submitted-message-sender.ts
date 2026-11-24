import type { SessionMessageSender } from "pstdio-api-contracts";

export const submittedRequestId = (sessionId: string, position: number) => `${sessionId}:${position}`;
export const submittedMessageSender = (input: {
  sessionId: string;
  submittedQueuePosition?: number;
  sender?: SessionMessageSender;
}) => {
  if (!input.sender || input.submittedQueuePosition === undefined) return input.sender;
  const { type, id, name } = input.sender;
  return { type, id, name, requestId: submittedRequestId(input.sessionId, input.submittedQueuePosition) };
};

export const prepareSubmittedSender = async (
  conversation: import("./session-conversation").SessionConversation,
  input: { sessionId: string; prompt: string; submittedQueuePosition?: number; sender?: SessionMessageSender },
  queue?: import("./deps").SessionsRouteDeps["sessionQueueEntriesService"],
) => {
  if (!input.sender) return;
  let afterTurn: number | undefined;
  if (queue && input.submittedQueuePosition !== undefined) {
    const count = conversation.getMessages().filter((message) => message.role === "user").length;
    const entry = await queue.setDispatchSenderBoundary(input.submittedQueuePosition, count);
    if (!entry) throw new Error("Submitted request is no longer available.");
    afterTurn = entry.sender_json?.afterTurn;
  }
  conversation.attributePrompt(input.prompt, submittedMessageSender(input), undefined, afterTurn);
};
