import type { SessionMessage } from "@pstdio/ui/chat-ui";
import type { SessionAttachmentRef } from "../session-attachment-ref";

export type PendingFollowUpState = {
  prompt: string;
  attachments: SessionAttachmentRef[];
  projectId?: string;
  messageCount: number;
  userMessageId: string;
  assistantMessageId: string;
  sessionId: string | null;
};

export const createPendingFollowUpState = (input: {
  prompt: string;
  attachments?: SessionAttachmentRef[];
  projectId?: string;
  messageCount: number;
  pendingId: string;
  sessionId?: string | null;
}): PendingFollowUpState => {
  return {
    prompt: input.prompt,
    attachments: input.attachments ?? [],
    projectId: input.projectId,
    messageCount: input.messageCount,
    userMessageId: `${input.pendingId}-user`,
    assistantMessageId: `${input.pendingId}-assistant`,
    sessionId: input.sessionId ?? null,
  };
};

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
  const projectQuery = pending.projectId ? `?project_id=${encodeURIComponent(pending.projectId)}` : "";

  return [
    {
      id: pending.userMessageId,
      role: "user",
      parts: [
        { type: "text", text: pending.prompt },
        ...pending.attachments.map((attachment) => ({
          type: "file" as const,
          mediaType: attachment.mime_type,
          filename: attachment.file_name,
          url: `/v1/sessions/attachments/${attachment.id}/content${projectQuery}`,
        })),
      ],
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

export const shouldClearPendingFollowUp = (pending: PendingFollowUpState | null, messages: SessionMessage[]) => {
  if (!pending) return false;
  return messages.length > pending.messageCount;
};
