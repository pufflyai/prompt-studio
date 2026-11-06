import type { ChatQueuedRequest, ChatRendererAction } from "@pstdio/sdk/extensions";
import { applySessionMessagePatch, type SessionMessage } from "@pstdio/ui/chat-ui";
import { createPendingChatQueuePresentation } from "./chat-pending-queue";
import { chatMessageIdentity, claimSubmittedChatMessages } from "./chat-submission-identity";

export const createChatPendingSubmission = (
  action: Extract<ChatRendererAction, { type: "submit" }>,
  messages: SessionMessage[],
  queued?: ChatQueuedRequest[],
  sequence = 0,
) => ({
  sequence,
  queue: queued !== undefined,
  failure: undefined as string | undefined,
  recoveryAdded: false,
  echoed: false,
  values: action.values,
  knownMessages: new Set(messages.flatMap((message) => [message.id, chatMessageIdentity(message)])),
  accepted: false,
  text: action.text,
  attachments: action.attachments,
  known: new Set((queued ?? messages).map((item) => item.id)),
  message: {
    id: `pending-${crypto.randomUUID()}`,
    role: "user" as const,
    parts: [
      { type: "text" as const, text: action.text },
      ...action.attachments.map((attachment) => ({
        type: "file" as const,
        fileId: attachment.id,
        filename: attachment.name,
        mediaType: attachment.mediaType,
        size: attachment.size,
        url: attachment.url ?? "",
      })),
    ],
  },
});
export type ChatPendingSubmission = ReturnType<typeof createChatPendingSubmission>;

/** Presentation is separate from canonical indexes so live patches never address optimistic rows. */
export const createChatSubmissionPresentation = () => {
  let previous: SessionMessage[] = [];
  let identities = new Map<string, { id: string; upstream: string; presentation: string }>();
  const claimed = new Map<string, string>();
  const queuePresentation = createPendingChatQueuePresentation(claimed);
  return (messages: SessionMessage[], pending: ChatPendingSubmission[] = [], queued: ChatQueuedRequest[] = []) => {
    const canonical = applySessionMessagePatch(previous, { op: "replace", path: "/messages", value: messages }).map(
      (message, index) => {
        // An upstream normalizer may retain its optimistic ID when the harness confirms it.
        // Compose that identity with our already displayed receipt instead of replacing the row.
        const incoming = messages[index];
        const upstream = chatMessageIdentity(incoming);
        const known = identities.get(incoming.id) ?? identities.get(upstream);
        const retained =
          known &&
          (known.upstream === upstream ||
            known.id === upstream ||
            (!incoming.animationKey && known.id === incoming.id));
        return retained ? { ...message, animationKey: known.presentation } : message;
      },
    );
    const retained = new Set(canonical.map((message) => message.animationKey));
    for (const identity of claimed.keys()) if (!retained.has(identity)) claimed.delete(identity);
    const receipts = queuePresentation.transfer(queued, pending, canonical);
    const issued = new Map([...receipts, ...pending].map((item) => [item.message.id, item]));
    claimSubmittedChatMessages(
      canonical,
      [...issued.values()].sort((a, b) => a.sequence - b.sequence),
      claimed,
    );
    const queue = queuePresentation.present(queued, pending, canonical);
    const present = [...canonical];
    const claimedNow = new Set<string>();
    const waiting: ChatPendingSubmission[] = [...queue.pending];
    for (const item of [...pending.filter((item) => !item.queue), ...queue.pending.filter((item) => item.failure)]) {
      if (item.failure) {
        present.push({ ...item.message, delivery: "unsent" });
        continue;
      }
      const accepted = canonical.find(
        (message) => !claimedNow.has(message.id) && claimed.get(chatMessageIdentity(message)) === item.message.id,
      );
      if (accepted) {
        claimedNow.add(accepted.id);
        const index = canonical.indexOf(accepted);
        present[index] = { ...accepted, animationKey: item.message.id };
        claimed.delete(chatMessageIdentity(accepted));
        claimed.set(item.message.id, item.message.id);
        if (!item.accepted) waiting.push(item);
      } else {
        waiting.push(item);
        present.push(item.message, {
          id: `${item.message.id}-loading`,
          role: "assistant",
          parts: [{ type: "loading" }],
        });
      }
    }
    previous = present;
    // Keep only aliases of retained canonical rows, including the upstream optimistic identity.
    // A genuinely different explicit animation key remains the provider's new identity.
    identities = new Map(
      messages.flatMap((message, index) => {
        const identity = {
          id: message.id,
          upstream: chatMessageIdentity(message),
          presentation: chatMessageIdentity(present[index]),
        };
        return [
          [identity.id, identity],
          [identity.upstream, identity],
        ];
      }),
    );
    const waitingById = new Map(waiting.map((item) => [item.message.id, item]));
    const ordered = pending.flatMap((item) => waitingById.get(item.message.id) ?? []);
    return { messages: present, queuedFollowUps: queue.items, pending: ordered.length ? ordered : undefined };
  };
};

export const visibleChatDraftAttachments = (
  attachments: ChatPendingSubmission["attachments"],
  pending?: ChatPendingSubmission | ChatPendingSubmission[],
) => {
  const submitted = pending ? [pending].flat() : [];
  return attachments.filter(
    (attachment) => !submitted.some((item) => item.attachments.some((sent) => sent.id === attachment.id)),
  );
};
