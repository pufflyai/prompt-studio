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

/** A late canonical acknowledgement makes only this failure's newly saved recovery obsolete. */
export const clearDeliveredChatRecoveries = (
  draft: ChatDraft,
  before: ChatPendingSubmission[],
  after?: ChatPendingSubmission[],
) => {
  const delivered = before.filter(
    (item) =>
      item.failure && item.recoveryAdded && !after?.some((remaining) => remaining.message.id === item.message.id),
  );
  if (delivered.length)
    return {
      recovered: draft.recovered?.filter(
        (saved) => !delivered.some((item) => chatDraftContentKey(item) === chatDraftContentKey(saved)),
      ),
    };
};
