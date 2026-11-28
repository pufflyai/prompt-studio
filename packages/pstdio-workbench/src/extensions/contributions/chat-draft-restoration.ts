import type { ChatDraft } from "@pstdio/sdk/extensions";
import { restoreFailedChatSubmission } from "./chat-failed-submission";
import type { ChatPendingSubmission } from "./chat-pending-submission";
import type { createChatSnapshot } from "./chat-snapshot";

export const hasUnresolvedChatSubmission = (pending?: ChatPendingSubmission[]) =>
  pending?.some((item) => item.unresolved?.recovery.isRetained()) ?? false;

export const discardPendingChatSubmission = (
  input: {
    read: () => { pending?: ChatPendingSubmission[] };
    publish: (update: { pending?: ChatPendingSubmission[] }) => void;
  },
  id: string,
) => {
  const { pending } = input.read();
  const attempt = pending?.find((item) => item.message.id === id && item.unresolved);
  if (attempt) input.publish({ pending: pending?.filter((item) => item !== attempt) });
};

export const createChatDraftRestoration = (input: {
  active: () => boolean;
  hasRetainedSubmission?: () => boolean;
  subscribeSubmissions?: (listener: () => void) => () => void;
  inspectResources?: () => void;
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
    hasUnresolvedSubmission: () =>
      Boolean(input.hasRetainedSubmission?.()) || hasUnresolvedChatSubmission(input.read().pending),
    subscribeSubmissions: input.subscribeSubmissions ?? (() => () => {}),
    inspectResources: input.inspectResources,
    discardUnresolvedSubmission(id: string) {
      if (input.active()) discardPendingChatSubmission(input, id);
    },
    dismissSubmission(id: string) {
      if (!input.active()) return;
      const { pending } = input.read();
      const failed = pending?.find((item) => item.message.id === id && item.failure && !item.failureDismissed);
      if (!failed) return;
      // The receipt keeps its hidden attachments until delivery or an explicit restore.
      input.publish({
        pending: pending?.map((item) => (item === failed ? { ...item, failureDismissed: true } : item)),
      });
    },
    restoreSubmission,
  };
};
