import type { ChatDraft } from "@pstdio/sdk/extensions";

const chatDraftContent = (draft: ChatDraft) => ({
  text: draft.text,
  attachments: draft.attachments,
  values: draft.values,
});
const hasContent = (draft: ChatDraft) =>
  Boolean(draft.text || draft.attachments.length || Object.keys(draft.values).length);

export const chatDraftContentKey = (draft: ChatDraft) => JSON.stringify(chatDraftContent(draft));

export const canReplaceRecoveredChatDraft = (draft: ChatDraft, changes: number, recoveryKey: string | undefined) =>
  (changes === 0 &&
    !draft.text &&
    !draft.attachments.length &&
    !draft.recovered?.length &&
    !Object.keys(draft.values).length) ||
  chatDraftContentKey(draft) === recoveryKey;

/** Keep both drafts when someone starts typing before the extension's storage read completes. */
export const hydrateChatDraft = (current: ChatDraft, saved: ChatDraft) => {
  const key = chatDraftContentKey;
  const seen = new Set([key(current)]);
  const recovered = [...(current.recovered ?? []), chatDraftContent(saved), ...(saved.recovered ?? [])].filter(
    (draft) => {
      if (!hasContent(draft) || seen.has(key(draft))) return false;
      seen.add(key(draft));
      return true;
    },
  );
  return { ...current, recovered };
};

export const restoreChatDraft = (current: ChatDraft, index: number) => {
  const saved = current.recovered?.[index];
  if (!saved) throw new Error("This saved draft is no longer available.");
  return hydrateChatDraft({ ...saved, recovered: current.recovered?.filter((_, i) => i !== index) }, current);
};

/** A failed operation carries its own recoveries; none may replace earlier unsent work. */
export const recoverChatDraft = (current: ChatDraft, failed: ChatDraft, replace: boolean) => {
  if (!replace) return hydrateChatDraft(current, failed);
  if (!current.recovered?.length) return failed;
  return hydrateChatDraft(failed, { text: "", attachments: [], values: {}, recovered: current.recovered });
};

/** Host control hydration advances the same recovered content; user edits keep their own boundary. */
export const rebaseChatRecoveryKey = (key: string | undefined, previous: ChatDraft, next: ChatDraft) =>
  chatDraftContentKey(previous) === key ? chatDraftContentKey(next) : key;
