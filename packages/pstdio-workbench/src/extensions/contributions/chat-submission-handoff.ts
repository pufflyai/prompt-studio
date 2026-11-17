import type { ChatPendingSubmission } from "./chat-pending-submission";

/** Transfer transient receipts only; each resource keeps its own draft, transcript and transport. */
export const createChatSubmissionHandoff = (
  read: () => ChatPendingSubmission[] | undefined,
  publish: (update: { pending?: ChatPendingSubmission[] }) => void,
) => ({
  receivePending(pending: ChatPendingSubmission[]) {
    publish({ pending: pending.map((item) => ({ ...item, accepted: true })) });
  },
  transferPending(receive: (pending: ChatPendingSubmission[]) => void) {
    const pending = read();
    if (!pending?.length) return;
    receive(pending);
    const transferred = new Set(pending.map((item) => item.message.id));
    publish({ pending: read()?.filter((item) => !transferred.has(item.message.id)) });
  },
});
