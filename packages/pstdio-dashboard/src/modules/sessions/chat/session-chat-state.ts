import type { SessionMessage } from "@pstdio/ui/chat-ui";
import type { SessionAttachment } from "pstdio-api-contracts";

export type PendingFollowUpState = {
  prompt: string;
  messageCount: number;
  userMessageId: string;
  assistantMessageId: string;
  sessionId: string | null;
  attachments?: SessionAttachment[];
};

export const createPendingFollowUpState = (input: {
  prompt: string;
  messageCount: number;
  pendingId: string;
  sessionId?: string | null;
  attachments?: SessionAttachment[];
}): PendingFollowUpState => {
  return {
    prompt: input.prompt,
    messageCount: input.messageCount,
    userMessageId: `${input.pendingId}-user`,
    assistantMessageId: `${input.pendingId}-assistant`,
    sessionId: input.sessionId ?? null,
    attachments: input.attachments,
  };
};

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

export const createOptimisticFollowUpMessages = (pending: PendingFollowUpState): SessionMessage[] => {
  return [
    {
      id: pending.userMessageId,
      role: "user",
      parts: [{ type: "text", text: pending.prompt }, ...attachmentParts(pending.attachments)],
    },
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
