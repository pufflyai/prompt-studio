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
