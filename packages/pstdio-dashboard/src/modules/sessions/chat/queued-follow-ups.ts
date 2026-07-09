import type { QueuedFollowUp, SessionMessage } from "@pstdio/ui/chat-ui";

const queuedPromptPrefix = "queued-prompt-";

const getQueuedPromptPosition = (messageId: string, sessionId: string | null) => {
  if (!sessionId) return null;

  const expectedPrefix = `${queuedPromptPrefix}${sessionId}-`;
  if (!messageId.startsWith(expectedPrefix)) return null;

  const position = Number(messageId.slice(expectedPrefix.length));
  if (!Number.isInteger(position)) return null;

  return position;
};

const getPromptText = (message: SessionMessage) =>
  message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();

const getAttachments = (message: SessionMessage): QueuedFollowUp["attachments"] =>
  message.parts
    .filter((part) => part.type === "file")
    .map((part) => ({
      id: part.fileId ?? part.url,
      name: part.filename ?? part.url.split("/").pop() ?? "Attachment",
      mediaType: part.mediaType,
      url: part.url,
    }));

export const splitQueuedFollowUps = (messages: SessionMessage[], sessionId: string | null) => {
  const transcriptMessages: SessionMessage[] = [];
  const queuedFollowUps: QueuedFollowUp[] = [];

  for (const message of messages) {
    const position = message.role === "user" ? getQueuedPromptPosition(message.id, sessionId) : null;
    if (position === null) {
      transcriptMessages.push(message);
      continue;
    }

    queuedFollowUps.push({
      id: message.id,
      prompt: getPromptText(message),
      attachments: getAttachments(message),
      position,
    });
  }

  return { messages: transcriptMessages, queuedFollowUps };
};
