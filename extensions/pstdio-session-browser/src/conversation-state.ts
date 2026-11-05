import type { PendingQueuedFollowUpsResponse } from "@pstdio/sdk/api";
import type { ChatQueuedRequest, SessionMessage } from "@pstdio/sdk/extensions";

const steeringReason = (
  remote: boolean,
  queue: PendingQueuedFollowUpsResponse | undefined,
  requestReason?: string | null,
) => {
  if (remote) return "Live steering is unavailable on another device.";
  return queue?.steeringAvailable ? requestReason : queue?.steeringUnavailableReason;
};

// Queue presentation uses the same canonical messages; accepted steering belongs to the transcript.
export const conversationState = (
  sessionId: string,
  input: SessionMessage[],
  queue?: PendingQueuedFollowUpsResponse,
  harnessId?: string | null,
  remote = false,
) => {
  const prefix = `queued-prompt-${sessionId}-`;
  const messages = input.filter((message) => !message.id.startsWith(prefix));
  const known = new Set(messages.map((message) => message.id));
  const handoffs = new Map<string, SessionMessage>();
  const queuedFollowUps: ChatQueuedRequest[] = [];
  for (const message of input) {
    if (!message.id.startsWith(prefix)) continue;
    const position = Number(message.id.slice(prefix.length));
    const request = queue?.requests.find((entry) => entry.queuePosition === position);
    if (request?.steeringDelivery) {
      handoffs.set(request.steeringDelivery.id, message);
      if (!known.has(request.steeringDelivery.id)) {
        messages.push({ ...message, id: request.steeringDelivery.id });
        known.add(request.steeringDelivery.id);
      }
      continue;
    }
    queuedFollowUps.push({
      id: message.id,
      position,
      revision: request?.revision,
      prompt: message.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n"),
      activeRunStartedAt: queue?.activeRunStartedAt,
      values:
        harnessId && request
          ? { harness: { harnessId, ...(request.model ? { model: request.model } : {}), params: request.params } }
          : undefined,
      model: request?.model,
      params: request?.params,
      steeringDelivery: request?.steeringDelivery,
      steeringUnavailableReason: steeringReason(remote, queue, request?.steeringUnavailableReason),
      attachments: message.parts
        .filter((part) => part.type === "file")
        .map((part) => ({
          id: part.fileId ?? part.url,
          name: part.filename ?? "Attachment",
          url: part.url,
          mediaType: part.mediaType,
          size: part.size,
        })),
    });
  }
  const displayed = messages.map((message) => {
    const handoff = handoffs.get(message.id);
    if (!handoff) return message;
    const knownFiles = new Set(
      message.parts.filter((part) => part.type === "file").map((part) => part.fileId ?? part.url),
    );
    const missing = handoff.parts.filter((part) => part.type === "file" && !knownFiles.has(part.fileId ?? part.url));
    return missing.length ? { ...message, parts: [...message.parts, ...missing] } : message;
  });
  return { messages: displayed, queuedFollowUps, queueReadOnly: !queue || Boolean(queue.readOnly) };
};
