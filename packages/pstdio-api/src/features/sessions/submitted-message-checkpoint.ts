import { type SessionMessage, submittedPrompt } from "pstdio-api-contracts";

export const hasSubmittedMessageCheckpoint = (
  messages: SessionMessage[],
  submitted: { submittedAttachmentFileIds: string[]; sender?: SessionMessage["sender"]; prompt?: string },
) =>
  submitted.submittedAttachmentFileIds.every((fileId) =>
    messages.some((message) => message.parts.some((part) => part.type === "file" && part.fileId === fileId)),
  ) &&
  (!submitted.sender ||
    (submitted.sender.requestId !== undefined &&
      messages.some(
        (message) =>
          message.role === "user" &&
          message.sender?.requestId === submitted.sender?.requestId &&
          submittedPrompt(message) === submitted.prompt?.trim(),
      )));
