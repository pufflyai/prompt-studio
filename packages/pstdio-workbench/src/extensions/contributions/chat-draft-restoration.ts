import type { ChatDraft } from "@pstdio/sdk/extensions";
import { chatDraftContentKey, restoreChatDraft } from "./chat-draft-recovery";
import { restoreFailedChatSubmission } from "./chat-failed-submission";
import type { ChatPendingSubmission } from "./chat-pending-submission";
import type { createChatSnapshot } from "./chat-snapshot";

export const createChatDraftRestoration = (input: {
  active: () => boolean;
  read: () => { draft: ChatDraft; pending?: ChatPendingSubmission[] };
  values: ReturnType<typeof createChatSnapshot>["values"];
  changeDraft: (draft: Partial<ChatDraft>) => void;
  publish: (update: { pending?: ChatPendingSubmission[] }) => void;
}) => {
  const restoreSubmission = (id: string) => {
    if (!input.active()) return;
    const { draft, pending } = input.read();
    const restored = restoreFailedChatSubmission(draft, pending, id);
    if (!restored) return;
    input.values.claim(restored.draft.values);
    input.changeDraft(restored.draft);
    input.publish({ pending: restored.pending });
  };
  return {
    dismissSubmission(id: string) {
      if (!input.active()) return;
      const { pending } = input.read();
      const failed = pending?.find((item) => item.message.id === id && item.failure && !item.failureDismissed);
      if (!failed) return;
      // Receipts still own hidden attachments and recovery until acknowledgement or explicit restore.
      input.publish({
        pending: pending?.map((item) => (item === failed ? { ...item, failureDismissed: true } : item)),
      });
    },
    restoreSubmission,
    restoreDraft(index: number) {
      if (!input.active()) return;
      const { draft, pending } = input.read();
      const saved = draft.recovered?.[index];
      const failed =
        saved &&
        pending?.find((item) => item.failureDismissed && chatDraftContentKey(item) === chatDraftContentKey(saved));
      if (failed) return restoreSubmission(failed.message.id);
      const restored = restoreChatDraft(draft, index);
      input.values.claim(restored.values);
      input.changeDraft(restored);
    },
  };
};
