import type { SessionAttachmentRef, SessionMessage } from "pstdio-api-contracts";

export const hasQueuedSteeringEvidence = (
  messages: SessionMessage[],
  deliveryId: string,
  attachments: SessionAttachmentRef[],
) => {
  const matching = messages.filter((message) => message.id === deliveryId && message.role === "user");
  if (matching.length !== 1) return false;
  const files = new Set(matching[0].parts.filter((part) => part.type === "file").map((part) => part.fileId));
  return attachments.every((attachment) => files.has(attachment.file_id));
};
