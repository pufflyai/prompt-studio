import type { ChatDraft } from "@pstdio/sdk/extensions";
import { type ChatPendingSubmission, visibleChatDraftAttachments } from "./chat-pending-submission";

/** Put failed input back in the composer ahead of any newer typing. Input already there is left alone. */
export const returnFailedChatInput = (draft: ChatDraft, failed: Pick<ChatDraft, "text" | "attachments">) => {
  const known = new Set(draft.attachments.map((attachment) => attachment.id));
  const attachments = failed.attachments.filter((attachment) => !known.has(attachment.id));
  if (!attachments.length && (!failed.text || draft.text.includes(failed.text))) return draft;
  return {
    ...draft,
    text: draft.text.includes(failed.text) ? draft.text : [failed.text, draft.text].filter(Boolean).join("\n\n"),
    attachments: [...attachments, ...draft.attachments],
  };
};

export const restoreFailedChatSubmission = (
  draft: ChatDraft,
  pending: ChatPendingSubmission[] | undefined,
  id: string,
) => {
  const failed = pending?.find((item) => item.message.id === id && item.failure);
  if (!failed) return;
  const visibleDraft = { ...draft, attachments: visibleChatDraftAttachments(draft.attachments, failed) };
  return { draft: returnFailedChatInput(visibleDraft, failed), pending: pending?.filter((item) => item !== failed) };
};
