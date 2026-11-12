import type { ChatDraft } from "@pstdio/sdk/extensions";
import { restoreChatDraft } from "./chat-draft-recovery";
import { restoreFailedChatSubmission } from "./chat-failed-submission";
import type { ChatPendingSubmission } from "./chat-pending-submission";
import type { createChatSnapshot } from "./chat-snapshot";

export const createChatDraftRestoration = (input: {
  active: () => boolean;
  read: () => { draft: ChatDraft; pending?: ChatPendingSubmission[] };
  values: ReturnType<typeof createChatSnapshot>["values"];
  changeDraft: (draft: Partial<ChatDraft>) => void;
  publish: (update: { pending?: ChatPendingSubmission[] }) => void;
}) => ({
  restoreSubmission(id: string) {
    if (!input.active()) return;
    const restored = restoreFailedChatSubmission(input.read().draft, input.read().pending, id);
    if (!restored) return;
    input.values.claim(restored.draft.values);
    input.changeDraft(restored.draft);
    input.publish({ pending: restored.pending });
  },
  restoreDraft(index: number) {
    if (!input.active()) return;
    const draft = restoreChatDraft(input.read().draft, index);
    input.values.claim(draft.values);
    input.changeDraft(draft);
  },
});
