import type { ChatInputQuestionResponse, SessionMessage } from "@pstdio/ui/chat-ui";
import type { SessionAttachment } from "pstdio-api-contracts";
import type { SetStateAction } from "react";
import type { SessionNotice } from "../data/session-notice";

export type PendingFollowUpState = {
  prompt: string;
  messageCount: number;
  submittedAt: number;
  previousRunStarted: string | null;
  userMessageId: string;
  assistantMessageId: string;
  attachments?: SessionAttachment[];
  questionResponse?: ChatInputQuestionResponse;
  // Set when the message could not be sent; it then stays in the conversation until resent or removed.
  failure?: SessionNotice;
};

export const createPendingFollowUpState = (input: {
  prompt: string;
  messageCount: number;
  pendingId: string;
  previousRunStarted?: string | null;
  attachments?: SessionAttachment[];
  questionResponse?: ChatInputQuestionResponse;
}): PendingFollowUpState => {
  return {
    prompt: input.prompt,
    messageCount: input.messageCount,
    submittedAt: Date.now(),
    previousRunStarted: input.previousRunStarted ?? null,
    userMessageId: `${input.pendingId}-user`,
    assistantMessageId: `${input.pendingId}-assistant`,
    attachments: input.attachments,
    questionResponse: input.questionResponse,
  };
};

// Only the submission that failed is marked; a newer submission keeps its own state.
export const failPendingFollowUp = (
  current: PendingFollowUpState | null,
  pending: PendingFollowUpState,
  failure: SessionNotice,
) => (current?.userMessageId === pending.userMessageId ? { ...current, failure } : current);

const attachmentParts = (attachments: SessionAttachment[] = []) =>
  attachments.map((attachment) => ({
    type: "file" as const,
    fileId: attachment.file_id,
    filename: attachment.name,
    mediaType: attachment.mime_type ?? undefined,
    size: attachment.size_bytes,
    url: attachment.url,
  }));

// A sent message belongs to one conversation: a new-session draft or a session, keyed like its
// stored draft. It lives outside React, so a request that ends after its chat panel unmounted
// still lands in its conversation, and a created session takes over its draft's first message.
const pendingByConversation = new Map<string, PendingFollowUpState>();
const pendingListeners = new Set<() => void>();
export const getPendingFollowUp = (conversationKey: string) => pendingByConversation.get(conversationKey) ?? null;
export const updatePendingFollowUp = (conversationKey: string, next: SetStateAction<PendingFollowUpState | null>) => {
  const current = getPendingFollowUp(conversationKey);
  const value = typeof next === "function" ? next(current) : next;
  if (value === current) return;
  if (value) pendingByConversation.set(conversationKey, value);
  else pendingByConversation.delete(conversationKey);
  for (const listener of pendingListeners) listener();
};
export const subscribePendingFollowUps = (listener: () => void) => {
  pendingListeners.add(listener);
  return () => {
    pendingListeners.delete(listener);
  };
};

export const createOptimisticFollowUpMessages = (pending: PendingFollowUpState): SessionMessage[] => {
  const userMessage: SessionMessage = {
    id: pending.userMessageId,
    role: "user",
    parts: [{ type: "text", text: pending.prompt }, ...attachmentParts(pending.attachments)],
  };
  if (pending.failure) return [{ ...userMessage, delivery: "unsent" }];
  return [
    userMessage,
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
  if (!pending.failure && hasAcceptedPendingFollowUp(messages, pending)) return messages;
  return [...messages, ...createOptimisticFollowUpMessages(pending)];
};

export const hasAcceptedPendingFollowUp = (messages: SessionMessage[], pending: PendingFollowUpState) =>
  messages.slice(pending.messageCount).some(
    (message) =>
      message.role === "user" &&
      message.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n") === pending.prompt,
  );
