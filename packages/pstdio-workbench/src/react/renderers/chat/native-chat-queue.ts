import type { ChatDraft, ChatQueuedRequest } from "@pstdio/sdk/extensions";

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
