import type { EventStore, JsonPatch, SessionMessage } from "pstdio-api-contracts";
import { applyConversationPatch, normalizeConversationPatch, normalizeMessageResults } from "pstdio-api-contracts";

// The bounded delivery log is deliberately not used to reconstruct conversation state.
export const createSessionConversation = (
  events: EventStore & { close(): void },
  initialMessages: SessionMessage[] = [],
  changed?: (patch: JsonPatch) => void,
) => {
  let messages = initialMessages.map(normalizeMessageResults);
  let closed = false;
  return {
    get closed() {
      return closed;
    },
    push(patch: JsonPatch) {
      if (closed) throw new Error("Conversation is closed");
      patch = normalizeConversationPatch(patch);
      messages = applyConversationPatch(messages, patch);
      events.push(patch);
      changed?.(patch);
    },
    getMessages: () => [...messages],
    get messageCount() {
      return messages.length;
    },
    snapshotAndSubscribe() {
      const iterator = events
        .subscribe({
          conversationSnapshot: () => ({ op: "replace", path: "/messages", value: [...messages] }),
        })
        [Symbol.asyncIterator]();
      return { messages: [...messages], stream: { [Symbol.asyncIterator]: () => iterator } };
    },
    close() {
      closed = true;
      events.close();
    },
  };
};

export type SessionConversation = ReturnType<typeof createSessionConversation>;
