import type { SessionMessage } from "@pstdio/ui/chat-ui";
import type { ChatPendingSubmission } from "./chat-pending-submission";
import { chatMessageIdentity } from "./chat-submission-identity";

/** Recall accepted input through receipt handoff without adding it to canonical/display indexes. */
export const createChatSubmissionHistory = () => {
  let sequences = new Map<string, number>();
  return (
    messages: SessionMessage[],
    issued: ChatPendingSubmission[],
    receipts: ChatPendingSubmission[],
    claims: Map<string, string>,
  ) => {
    const next = new Map<string, number>();
    const delivered = new Set(messages.map((message) => claims.get(chatMessageIdentity(message))));
    const history = messages.filter((message) => message.delivery !== "unsent");
    for (const message of history) {
      const identity = chatMessageIdentity(message);
      const submission = issued.find(
        (item) => item.message.id === claims.get(identity) || item.message.id === identity,
      );
      const sequence = submission?.sequence ?? sequences.get(identity);
      if (sequence !== undefined) next.set(identity, sequence);
    }
    for (const item of issued.filter((item) => item.queue && !item.failure).sort((a, b) => a.sequence - b.sequence)) {
      if (
        (!item.accepted && !receipts.some((receipt) => receipt.message.id === item.message.id)) ||
        delivered.has(item.message.id)
      )
        continue;
      const position = history.findIndex((message) => (next.get(chatMessageIdentity(message)) ?? -1) > item.sequence);
      history.splice(position === -1 ? history.length : position, 0, item.message);
      next.set(item.message.id, item.sequence);
    }
    // Queue priority and canonical arrival order can differ from local submission order.
    const ordered = history
      .filter((message) => next.has(chatMessageIdentity(message)))
      .sort((a, b) => next.get(chatMessageIdentity(a))! - next.get(chatMessageIdentity(b))!);
    let index = 0;
    sequences = next;
    return history.map((message) => (next.has(chatMessageIdentity(message)) ? ordered[index++]! : message));
  };
};
