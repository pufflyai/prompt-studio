import {
  type EventStore,
  type JsonPatch,
  type SessionHistoryIssue,
  type SessionMessage,
  sessionHistoryIssueSchema,
} from "pstdio-api-contracts";

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
) => {
  let messages = [...initialMessages];
  let closed = false;
  let historyIssue: SessionHistoryIssue | undefined;
  return {
    get closed() {
      return closed;
    },
    get historyIssue() {
      return historyIssue;
    },
    push(patch: JsonPatch) {
      if (closed) throw new Error("Conversation is closed");
      if (patch.path === "/history_issue") historyIssue = sessionHistoryIssueSchema.parse(patch.value);
      messages = applyMessagePatch(messages, patch);
      events.push(patch);
    },
    getMessages: () => [...messages],
    snapshotAndSubscribe() {
      const iterator = events.subscribe()[Symbol.asyncIterator]();
      return { messages: [...messages], historyIssue, stream: { [Symbol.asyncIterator]: () => iterator } };
    },
    close() {
      closed = true;
      events.close();
    },
  };
};

export type SessionConversation = ReturnType<typeof createSessionConversation>;
