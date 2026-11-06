import type { ChatDraft } from "@pstdio/sdk/extensions";
import { chatDraftContentKey, hydrateChatDraft, restoreChatDraft } from "./chat-draft-recovery";
import type { ChatPendingSubmission } from "./chat-pending-submission";

export const restoreFailedChatSubmission = (
  draft: ChatDraft,
  pending: ChatPendingSubmission[] | undefined,
  id: string,
) => {
  const failed = pending?.find((item) => item.message.id === id && item.failure);
  if (!failed) return;
  const index = draft.recovered?.findIndex((saved) => chatDraftContentKey(saved) === chatDraftContentKey(failed)) ?? -1;
  const restored =
    index < 0
      ? hydrateChatDraft({ text: failed.text, attachments: failed.attachments, values: failed.values }, draft)
      : restoreChatDraft(draft, index);
  return { draft: restored, pending: pending?.filter((item) => item !== failed) };
};

/** Transfer shared recovery ownership until the last failed input is delivered. */
export const clearDeliveredChatRecoveries = (
  draft: ChatDraft,
  before: ChatPendingSubmission[],
  after?: ChatPendingSubmission[],
) => {
  const delivered = before.filter(
    (item) =>
      item.failure && item.recoveryAdded && !after?.some((remaining) => remaining.message.id === item.message.id),
  );
  const keys = new Set(delivered.map(chatDraftContentKey));
  let pending = after;
  if (keys.size)
    pending = after?.map((item) =>
      item.failure && keys.has(chatDraftContentKey(item)) ? { ...item, recoveryAdded: true } : item,
    );
  const removable = new Set(
    [...keys].filter((key) => !pending?.some((item) => item.failure && chatDraftContentKey(item) === key)),
  );
  const recovery = removable.size
    ? { recovered: draft.recovered?.filter((saved) => !removable.has(chatDraftContentKey(saved))) }
    : undefined;
  return { pending, recovery };
};
