import type { EventStore, JsonPatch, SessionMessage } from "pstdio-api-contracts";
import { normalizeMessageResults } from "pstdio-api-contracts";

const normalizePatch = (patch: JsonPatch) => {
  if (patch.op === "remove") return patch;
  if (patch.path === "/messages" && Array.isArray(patch.value))
    return { ...patch, value: (patch.value as SessionMessage[]).map(normalizeMessageResults) };
  if (/^\/messages\/\d+$/.test(patch.path))
    return { ...patch, value: normalizeMessageResults(patch.value as SessionMessage) };
  return patch;
};

const applyMessagePatch = (messages: SessionMessage[], patch: JsonPatch) => {
  if (patch.path === "/messages" && (patch.op === "add" || patch.op === "replace")) {
    if (!Array.isArray(patch.value)) throw new Error("Conversation replacement must be an array");
    return [...(patch.value as SessionMessage[])];
  }
  const match = /^\/messages\/(\d+)$/.exec(patch.path);
  if (!match) return messages;
  const index = Number(match[1]);
  const limit = patch.op === "add" ? messages.length : messages.length - 1;
  if (!Number.isSafeInteger(index) || index > limit) throw new Error("Invalid conversation patch position");
  if (patch.op === "add") messages.splice(index, 0, patch.value as SessionMessage);
  else if (patch.op === "replace") messages[index] = patch.value as SessionMessage;
  else messages.splice(index, 1);
  return messages;
};

// The bounded delivery log is deliberately not used to reconstruct conversation state.
export const createSessionConversation = (
  events: EventStore & { close(): void },
  initialMessages: SessionMessage[] = [],
  changed?: () => void,
) => {
  let messages = initialMessages.map(normalizeMessageResults);
  let closed = false;
  return {
    get closed() {
      return closed;
    },
    push(patch: JsonPatch) {
      if (closed) throw new Error("Conversation is closed");
      patch = normalizePatch(patch);
      messages = applyMessagePatch(messages, patch);
      events.push(patch);
      changed?.();
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
