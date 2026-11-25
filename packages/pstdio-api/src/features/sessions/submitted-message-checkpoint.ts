import type { SessionMessage } from "pstdio-api-contracts";
import { matchesSubmittedPrompt, submittedMessageText } from "./submitted-message-identity";

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
          matchesSubmittedPrompt(submittedMessageText(message), submitted.prompt),
      )));
