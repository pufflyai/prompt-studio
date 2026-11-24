import type { ChatDraft, ChatQueuedRequest } from "@pstdio/sdk/extensions";
import type { QueuedFollowUp } from "@pstdio/ui/chat-ui";
import type { ChatActionPreview } from "../../../extensions/contributions/chat-action-operations";

/** Providers carry saved request settings under their own public control IDs. */
export const queuedChatDraft = (
  draft: ChatDraft,
  item: ChatQueuedRequest,
): Pick<ChatDraft, "values" | "attachments"> => ({
  values: { ...draft.values, ...item.values },
  attachments: item.attachments ?? [],
});

export const findQueuedChatRequest = (items: ChatQueuedRequest[] | undefined, id: string) => {
  const item = items?.find((candidate) => candidate.id === id);
  if (!item) throw new Error("The queued request is no longer available.");
  return item;
};

export const projectQueuedFollowUps = (items: QueuedFollowUp[], pending?: ChatActionPreview) => {
  const action = pending?.intent.action;
  if (action?.type !== "queue" || pending?.status === "unknown" || pending?.status === "unconfirmed") return items;
  const index = items.findIndex((item) => item.id === action.item.id && item.revision === action.item.revision);
  if (index < 0 || !action.item.revision) return items;
  if (action.operation === "update")
    return items.map((item, offset) =>
      offset === index ? { ...item, prompt: action.prompt ?? item.prompt, attachments: action.attachments } : item,
    );
  if (action.operation === "remove") return items.filter((_item, offset) => offset !== index);
  if (action.operation !== "move" || !action.direction || items.some((item) => !item.revision || item.sending))
    return items;
  const destination = index + (action.direction === "up" ? -1 : 1) * (action.steps ?? 1);
  if (destination < 0 || destination >= items.length) return items;
  const reordered = [...items];
  const [moved] = reordered.splice(index, 1);
  reordered.splice(destination, 0, moved!);
  return reordered;
};
