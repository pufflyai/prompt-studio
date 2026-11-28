import type { ChatPendingSubmission } from "./chat-pending-submission";

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
  read: () => { pending?: ChatPendingSubmission[] };
  publish: (update: { pending?: ChatPendingSubmission[] }) => void;
}) => ({
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
    // The receipt stays so a late delivery can still claim it.
    input.publish({
      pending: pending?.map((item) => (item === failed ? { ...item, failureDismissed: true } : item)),
    });
  },
});
