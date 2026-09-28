import type { ChatInputQuestionResponse, SessionMessage } from "@pstdio/ui/chat-ui";
import type { SessionAttachment } from "pstdio-api-contracts";
import type { SessionNotice } from "../data/session-notice";

export type PendingFollowUpState = {
  prompt: string;
  messageCount: number;
  userMessageId: string;
  assistantMessageId: string;
  sessionId: string | null;
  attachments?: SessionAttachment[];
  questionResponse?: ChatInputQuestionResponse;
  // Set when the message could not be sent; it then stays in the conversation until resent or removed.
  failure?: SessionNotice;
};

export const createPendingFollowUpState = (input: {
  prompt: string;
  messageCount: number;
  pendingId: string;
  sessionId?: string | null;
  attachments?: SessionAttachment[];
  questionResponse?: ChatInputQuestionResponse;
}): PendingFollowUpState => {
  return {
    prompt: input.prompt,
    messageCount: input.messageCount,
    userMessageId: `${input.pendingId}-user`,
    assistantMessageId: `${input.pendingId}-assistant`,
    sessionId: input.sessionId ?? null,
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

export const assignPendingFollowUpSession = (
  pending: PendingFollowUpState,
  sessionId: string,
): PendingFollowUpState => {
  return {
    ...pending,
    sessionId,
  };
};

// Opening a created session can mount a new chat panel. The draft hands its first message to that
// panel, so the message stays visible until the session's own conversation includes it.
const handedOff = new Map<string, PendingFollowUpState>();
export const handOffPendingFollowUp = (pending: PendingFollowUpState) => {
  if (pending.sessionId) handedOff.set(pending.sessionId, pending);
};
export const peekHandedOffPendingFollowUp = (sessionId: string | null) =>
  (sessionId && handedOff.get(sessionId)) || null;
export const forgetHandedOffPendingFollowUp = (sessionId: string | null) => {
  if (sessionId) handedOff.delete(sessionId);
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

export const shouldShowPendingFollowUp = (pending: PendingFollowUpState | null, sessionId: string | null) => {
  if (!pending) return false;
  return pending.sessionId === sessionId;
};

export const mergeMessagesWithPendingFollowUp = (
  messages: SessionMessage[],
  pending: PendingFollowUpState | null,
): SessionMessage[] => {
  if (!pending) return messages;
  return [...messages, ...createOptimisticFollowUpMessages(pending)];
};
