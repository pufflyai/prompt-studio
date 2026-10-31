import type { PendingQueuedFollowUpsResponse } from "@pstdio/sdk/api";
import type { QueuedFollowUp, SessionMessage } from "@pstdio/ui/chat-ui";

export interface SteeringSubmission {
  item: QueuedFollowUp;
  previousUserMessageIds: string[];
  deliveryId?: string;
}

export const projectSteeringSubmission = (
  messages: SessionMessage[],
  queuedFollowUps: QueuedFollowUp[],
  submission: SteeringSubmission | null,
  queue?: PendingQueuedFollowUpsResponse,
) => {
  if (!submission) return { messages, queuedFollowUps };
  const { item, previousUserMessageIds } = submission;
  const deliveryId =
    queue?.requests.find((request) => request.queuePosition === item.position)?.steeringDelivery?.id ??
    submission.deliveryId;
  const confirmed = messages.some((message) => {
    if (message.role !== "user") return false;
    if (deliveryId) return message.id === deliveryId;
    return (
      !previousUserMessageIds.includes(message.id) &&
      message.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n") === item.prompt &&
      (item.attachments ?? []).every((file) =>
        message.parts.some((part) => part.type === "file" && part.fileId === file.id),
      )
    );
  });
  const optimistic: SessionMessage = {
    id: deliveryId ?? item.id,
    role: "user",
    parts: [
      { type: "text", text: item.prompt },
      ...(item.attachments ?? []).map((file) => ({
        type: "file" as const,
        fileId: file.id,
        filename: file.name,
        mediaType: file.mediaType,
        size: file.size,
        url: file.url ?? "",
      })),
    ],
  };
  return {
    messages: confirmed ? messages : [...messages, optimistic],
    queuedFollowUps: queuedFollowUps.filter((queued) => queued.id !== item.id),
  };
};
