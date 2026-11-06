import type { ChatQueuedRequest } from "@pstdio/sdk/extensions";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import type { ChatPendingSubmission } from "./chat-pending-submission";
import { chatMessageIdentity } from "./chat-submission-identity";

const matchesQueuedRequest = (item: ChatPendingSubmission, request: ChatQueuedRequest) =>
  !item.known.has(request.id) &&
  request.prompt === item.text &&
  (request.attachments?.length ?? 0) === item.attachments.length &&
  item.attachments.every((file) => request.attachments?.some((saved) => saved.id === file.id));

const canClaim = (claims: Map<string, string>, id: string, owner: string) =>
  !claims.has(id) || claims.get(id) === owner;
const claimQueuedReceipt = (
  claims: Map<string, string>,
  receipts: Map<string, ChatPendingSubmission>,
  item: ChatPendingSubmission,
  request: ChatQueuedRequest,
  echoed: boolean,
) => {
  claims.set(request.id, item.message.id);
  if (!echoed) receipts.set(request.id, item);
};

/** Queue receipts can disappear before their canonical history arrives. */
export const createPendingChatQueuePresentation = (messageClaims: Map<string, string>) => {
  const claims = new Map<string, string>();
  const receipts = new Map<string, ChatPendingSubmission>();
  let capacity = 0;
  const transfer = (saved: ChatQueuedRequest[], pending: ChatPendingSubmission[], messages: SessionMessage[]) => {
    capacity = Math.max(capacity, saved.length + pending.length + messages.length);
    for (const id of claims.keys()) if (!saved.some((item) => item.id === id)) claims.delete(id);
    // Bound abandoned receipts by the largest retained view, rather than cumulative sends.
    for (const id of receipts.keys()) {
      if (receipts.size <= capacity) break;
      if (!saved.some((item) => item.id === id)) receipts.delete(id);
    }
    return [...receipts.values()];
  };
  const reconcile = (item: ChatPendingSubmission, saved: ChatQueuedRequest[], messages: SessionMessage[]) => {
    const accepted = saved.find(
      (request) => canClaim(claims, request.id, item.message.id) && matchesQueuedRequest(item, request),
    );
    const echo = messages.some((message) => messageClaims.get(chatMessageIdentity(message)) === item.message.id);
    if (accepted || echo) {
      if (accepted) claimQueuedReceipt(claims, receipts, item, accepted, echo);
      return { pending: !item.accepted && !item.failure ? { ...item, echoed: true } : undefined };
    }
    return {
      pending: item,
      row: item.failure
        ? undefined
        : { id: item.message.id, prompt: item.text, attachments: item.attachments, sending: true },
    };
  };
  const present = (saved: ChatQueuedRequest[], pending: ChatPendingSubmission[], messages: SessionMessage[]) => {
    for (const [id, item] of receipts) {
      if (messages.some((message) => messageClaims.get(chatMessageIdentity(message)) === item.message.id))
        receipts.delete(id);
    }
    const items = [...saved];
    const waiting: ChatPendingSubmission[] = [];
    for (const item of pending.filter((candidate) => candidate.queue)) {
      if (item.accepted && item.echoed) continue;
      const next = reconcile(item, saved, messages);
      if (next.pending) waiting.push(next.pending);
      if (next.row) items.push(next.row);
    }
    return { items, pending: waiting };
  };
  return { transfer, present };
};
