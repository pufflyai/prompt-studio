import type { PendingQueuedFollowUpsResponse } from "@pstdio/sdk/api";
import type { QueuedFollowUp, SessionMessage } from "@pstdio/ui/chat-ui";
import { hasAcceptedPendingFollowUp, type PendingFollowUpState } from "./session-chat-state";
import { hasPendingSessionRunStarted } from "./session-work-start";

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
    .join("\n");

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

// The server shows a sent message once the queue list shows its saved request, or once a new run
// shows it in the conversation. Until then the client keeps its own copy.
export const serverShowsPendingFollowUp = (
  messages: SessionMessage[],
  sessionId: string | null,
  pending: PendingFollowUpState,
  lastRequestStarted: string | null,
) =>
  messages.some((message) => getQueuedPromptPosition(message.id, sessionId) === pending.queuePosition) ||
  (hasAcceptedPendingFollowUp(messages, pending) &&
    hasPendingSessionRunStarted(lastRequestStarted, pending.previousRunStarted));

export const splitQueuedFollowUps = (
  messages: SessionMessage[],
  sessionId: string | null,
  queue?: PendingQueuedFollowUpsResponse,
  pending?: PendingFollowUpState | null,
) => {
  const transcriptMessages: SessionMessage[] = [];
  const queuedFollowUps: QueuedFollowUp[] = [];
  const userIds = new Set(messages.filter((message) => message.role === "user").map((message) => message.id));
  const handoffs = new Map<string, SessionMessage>();

  for (const message of messages) {
    const position = message.role === "user" ? getQueuedPromptPosition(message.id, sessionId) : null;
    if (position === null) {
      transcriptMessages.push(message);
      continue;
    }

    const request = queue?.requests.find((item) => item.queuePosition === position);
    if (request?.steeringDelivery) {
      const id = request.steeringDelivery.id;
      handoffs.set(id, message);
      if (!userIds.has(id)) transcriptMessages.push({ ...message, id });
      continue;
    }
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

  if (pending?.destination === "queue" && !pending.failure && !hasAcceptedPendingFollowUp(messages, pending)) {
    queuedFollowUps.push({
      id: pending.userMessageId,
      prompt: pending.prompt,
      sending: true,
      attachments: pending.attachments?.map((file) => ({
        id: file.file_id,
        name: file.name,
        mediaType: file.mime_type ?? undefined,
        size: file.size_bytes,
        url: file.url,
      })),
    });
  }
  // The durable handoff owns optimism. Rejection clears it and restores the saved queue row;
  // native confirmation replaces the projected message by the same identity.
  const displayedMessages = transcriptMessages.map((message) => {
    const handoff = handoffs.get(message.id);
    if (!handoff) return message;
    const files = new Set(message.parts.filter((part) => part.type === "file").map((part) => part.fileId ?? part.url));
    const missing = handoff.parts.filter((part) => part.type === "file" && !files.has(part.fileId ?? part.url));
    return missing.length ? { ...message, parts: [...message.parts, ...missing] } : message;
  });
  return { messages: displayedMessages, queuedFollowUps };
};
