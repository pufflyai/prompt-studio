import type { ChatRendererAction } from "@pstdio/sdk/extensions";
import { applySessionMessagePatch, type SessionMessage } from "@pstdio/ui/chat-ui";

export const createChatPendingSubmission = (
  action: Extract<ChatRendererAction, { type: "submit" }>,
  messages: SessionMessage[],
) => ({
  accepted: false,
  text: action.text,
  attachments: action.attachments,
  known: new Set(messages.map((message) => message.id)),
  message: {
    id: `pending-${crypto.randomUUID()}`,
    role: "user" as const,
    parts: [
      { type: "text" as const, text: action.text },
      ...action.attachments.map((attachment) => ({
        type: "file" as const,
        fileId: attachment.id,
        filename: attachment.name,
        mediaType: attachment.mediaType,
        size: attachment.size,
        url: attachment.url ?? "",
      })),
    ],
  },
});
export type ChatPendingSubmission = ReturnType<typeof createChatPendingSubmission>;

/** Presentation is separate from canonical indexes so live patches never address optimistic rows. */
export const createChatSubmissionPresentation = () => {
  let previous: SessionMessage[] = [];
  const claimed = new Set<string>();
  return (messages: SessionMessage[], pending: ChatPendingSubmission[] = []) => {
    const canonical = applySessionMessagePatch(previous, { op: "replace", path: "/messages", value: messages });
    const retained = new Set(canonical.map((message) => message.animationKey));
    for (const identity of claimed) if (!retained.has(identity)) claimed.delete(identity);
    const present = [...canonical];
    const claimedNow = new Set<string>();
    const waiting: ChatPendingSubmission[] = [];
    for (const item of pending) {
      const accepted = canonical.find((message) => {
        const files = message.parts.filter((part) => part.type === "file");
        return (
          !item.known.has(message.id) &&
          !claimedNow.has(message.id) &&
          message.role === "user" &&
          (!claimed.has(message.animationKey ?? "") || message.animationKey === item.message.id) &&
          message.parts
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n") === item.text &&
          files.length === item.attachments.length &&
          item.attachments.every((attachment) =>
            files.some(
              (file) => file.fileId === attachment.id || Boolean(attachment.url && file.url === attachment.url),
            ),
          )
        );
      });
      if (accepted) {
        claimedNow.add(accepted.id);
        const index = canonical.indexOf(accepted);
        present[index] = { ...accepted, animationKey: item.message.id };
        claimed.add(item.message.id);
        if (!item.accepted) waiting.push(item);
      } else {
        waiting.push(item);
        present.push(item.message, {
          id: `${item.message.id}-loading`,
          role: "assistant",
          parts: [{ type: "loading" }],
        });
      }
    }
    previous = present;
    return { messages: present, pending: waiting.length ? waiting : undefined };
  };
};

export const visibleChatDraftAttachments = (
  attachments: ChatPendingSubmission["attachments"],
  pending?: ChatPendingSubmission | ChatPendingSubmission[],
) => {
  const submitted = pending ? [pending].flat() : [];
  return attachments.filter(
    (attachment) => !submitted.some((item) => item.attachments.some((sent) => sent.id === attachment.id)),
  );
};
