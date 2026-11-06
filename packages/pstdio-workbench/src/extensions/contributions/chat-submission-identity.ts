import type { SessionMessage } from "@pstdio/ui/chat-ui";
import type { ChatPendingSubmission } from "./chat-pending-submission";

export const chatMessageIdentity = (message: SessionMessage) => message.animationKey ?? message.id;
export const matchesSubmittedChatMessage = (item: ChatPendingSubmission, message: SessionMessage) =>
  message.role === "user" &&
  !item.knownMessages.has(message.id) &&
  !item.knownMessages.has(chatMessageIdentity(message)) &&
  message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n") === item.text &&
  message.parts.filter((part) => part.type === "file").length === item.attachments.length &&
  item.attachments.every((file) =>
    message.parts.some(
      (part) => part.type === "file" && (part.fileId === file.id || Boolean(file.url && part.url === file.url)),
    ),
  );

/** Both destinations claim echoes in submission order, using normalized identities across harness ID changes. */
export const claimSubmittedChatMessages = (
  messages: SessionMessage[],
  pending: ChatPendingSubmission[],
  claims: Map<string, string>,
) => {
  for (const item of pending) {
    const echo = messages.find((message) => {
      const owner = claims.get(chatMessageIdentity(message));
      return (!owner || owner === item.message.id) && matchesSubmittedChatMessage(item, message);
    });
    if (echo) claims.set(chatMessageIdentity(echo), item.message.id);
  }
};
