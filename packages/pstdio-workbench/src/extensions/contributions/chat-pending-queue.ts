import type { ChatQueuedRequest } from "@pstdio/sdk/extensions";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import type { ChatPendingSubmission } from "./chat-pending-submission";
import { chatMessageIdentity } from "./chat-submission-identity";

const matchesQueuedRequest = (item: ChatPendingSubmission, request: ChatQueuedRequest) =>
  !item.knownQueued.has(request.id) &&
  request.prompt === item.text &&
  (request.attachments?.length ?? 0) === item.attachments.length &&
  item.attachments.every((file) => request.attachments?.some((saved) => saved.id === file.id));

const canClaim = (claims: Map<string, string>, id: string, owner: string) =>
  !claims.has(id) || claims.get(id) === owner;
const findQueuedReceipt = (
  saved: ChatQueuedRequest[],
  claims: Map<string, string>,
  item: ChatPendingSubmission,
  echo: boolean,
) => {
  if (!item.queue && echo) return undefined;
  return saved.find((request) => canClaim(claims, request.id, item.message.id) && matchesQueuedRequest(item, request));
};
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
  const reconcile = (item: ChatPendingSubmission, saved: ChatQueuedRequest[], echo: boolean) => {
    if (item.echoed) return { pending: item.accepted ? undefined : item };
    // The server may queue an input while the client still shows an idle session.
    const receipt = findQueuedReceipt(saved, claims, item, echo);
    if (!item.queue && !receipt) return { transcript: item };
    if (receipt) claimQueuedReceipt(claims, receipts, { ...item, queue: true }, receipt, echo);
    if (receipt || echo) {
      return { pending: !item.accepted && !item.failure ? { ...item, queue: true, echoed: true } : undefined };
    }
    return {
      pending: item,
      row: item.failure
        ? undefined
        : { id: item.message.id, prompt: item.text, attachments: item.attachments, sending: true },
    };
  };
  const present = (saved: ChatQueuedRequest[], pending: ChatPendingSubmission[], messages: SessionMessage[]) => {
    const echoed = new Set(messages.map((message) => messageClaims.get(chatMessageIdentity(message))));
    for (const [id, item] of receipts) if (echoed.has(item.message.id)) receipts.delete(id);
    const items = [...saved];
    const waiting: ChatPendingSubmission[] = [];
    const transcript: ChatPendingSubmission[] = [];
    // Give sends already presented in the queue first claim on matching queue rows.
    for (const item of [...pending.filter((item) => item.queue), ...pending.filter((item) => !item.queue)]) {
      const next = reconcile(item, saved, echoed.has(item.message.id));
      if (next.transcript) transcript.push(next.transcript);
      if (next.pending) waiting.push(next.pending);
      if (next.row) items.push(next.row);
    }
    return { items, pending: waiting, transcript };
  };
  const captureRemoval = (id: string | undefined, submissions: Set<string>) => {
    const removed = id ? [id] : [...receipts.keys()];
    return () => {
      let changed = false;
      for (const [key, item] of receipts) {
        if (removed.includes(key) || submissions.has(item.message.id)) changed = receipts.delete(key) || changed;
      }
      return changed;
    };
  };
  return { transfer, present, captureRemoval };
};
