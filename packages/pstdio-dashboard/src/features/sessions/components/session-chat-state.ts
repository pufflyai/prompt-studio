import type { SessionMessage } from "@pstdio/ui/chat-ui";

export type PendingFollowUpState = {
  prompt: string;
  messageCount: number;
  userMessageId: string;
  assistantMessageId: string;
};

export const createPendingFollowUpState = (input: {
  prompt: string;
  messageCount: number;
  pendingId: string;
}): PendingFollowUpState => {
  return {
    prompt: input.prompt,
    messageCount: input.messageCount,
    userMessageId: `${input.pendingId}-user`,
    assistantMessageId: `${input.pendingId}-assistant`,
  };
};

export const createOptimisticFollowUpMessages = (pending: PendingFollowUpState): SessionMessage[] => {
  return [
    {
      id: pending.userMessageId,
      role: "user",
      parts: [{ type: "text", text: pending.prompt }],
    },
    {
      id: pending.assistantMessageId,
      role: "assistant",
      parts: [{ type: "loading" }],
    },
  ];
};

export const mergeMessagesWithPendingFollowUp = (
  messages: SessionMessage[],
  pending: PendingFollowUpState | null,
): SessionMessage[] => {
  if (!pending) return messages;
  return [...messages, ...createOptimisticFollowUpMessages(pending)];
};

export const shouldClearPendingFollowUp = (pending: PendingFollowUpState | null, messages: SessionMessage[]) => {
  if (!pending) return false;
  return messages.length > pending.messageCount;
};
