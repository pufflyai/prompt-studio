import type { PendingQueuedFollowUpsResponse } from "@pstdio/sdk/api";
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
      size: part.size,
    }));

const hasDeliveredRequest = (
  request: PendingQueuedFollowUpsResponse["requests"][number] | undefined,
  messages: SessionMessage[],
) => {
  if (!request?.steeringDelivery) return false;
  const matching = messages.filter((message) => message.role === "user" && message.id === request.steeringDelivery!.id);
  if (matching.length !== 1) return false;
  return request.attachments.every((file) =>
    matching[0].parts.some((part) => part.type === "file" && part.fileId === file.file_id),
  );
};

export const splitQueuedFollowUps = (
  messages: SessionMessage[],
  sessionId: string | null,
  queue?: PendingQueuedFollowUpsResponse,
) => {
  const transcriptMessages: SessionMessage[] = [];
  const queuedFollowUps: QueuedFollowUp[] = [];

  for (const message of messages) {
    const position = message.role === "user" ? getQueuedPromptPosition(message.id, sessionId) : null;
    if (position === null) {
      transcriptMessages.push(message);
      continue;
    }

    const request = queue?.requests.find((item) => item.queuePosition === position);
    // A queued SSE snapshot can precede durable removal but arrive after the accepted user patch.
    if (hasDeliveredRequest(request, messages)) continue;
    queuedFollowUps.push({
      revision: request?.revision,
      model: request?.model,
      params: request?.params,
      steeringDelivery: request?.steeringDelivery,
      steeringUnavailableReason: request?.steeringUnavailableReason,
      id: message.id,
      prompt: getPromptText(message),
      attachments: getAttachments(message),
      position,
    });
  }

  return { messages: transcriptMessages, queuedFollowUps };
};
