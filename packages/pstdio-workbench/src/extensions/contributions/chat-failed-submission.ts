import type { ChatDraft } from "@pstdio/sdk/extensions";

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
