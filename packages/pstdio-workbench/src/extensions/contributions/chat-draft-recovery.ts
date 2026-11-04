import type { ChatDraft } from "@pstdio/sdk/extensions";

const content = (draft: ChatDraft) => ({ text: draft.text, attachments: draft.attachments, values: draft.values });
const hasContent = (draft: ChatDraft) =>
  Boolean(draft.text || draft.attachments.length || Object.keys(draft.values).length);

/** Keep both drafts when someone starts typing before the extension's storage read completes. */
export const hydrateChatDraft = (current: ChatDraft, saved: ChatDraft) => {
  const key = (draft: ChatDraft) => JSON.stringify(content(draft));
  const seen = new Set([key(current)]);
  const recovered = [...(current.recovered ?? []), content(saved), ...(saved.recovered ?? [])].filter((draft) => {
    if (!hasContent(draft) || seen.has(key(draft))) return false;
    seen.add(key(draft));
    return true;
  });
  return { ...current, recovered };
};

export const restoreChatDraft = (current: ChatDraft, index: number) => {
  const saved = current.recovered?.[index];
  if (!saved) throw new Error("This saved draft is no longer available.");
  return hydrateChatDraft({ ...saved, recovered: current.recovered?.filter((_, i) => i !== index) }, current);
};
