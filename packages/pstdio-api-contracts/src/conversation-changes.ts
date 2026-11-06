import type { HarnessEventSink } from "./conversation-events";
import type { SessionMessage } from "./session-messages";
import { normalizeMessageResults } from "./tool-result";

/** Publish indexed changes while the native snapshot remains authoritative for membership. */
export const publishConversationChanges = (sink: HarnessEventSink, messages: readonly SessionMessage[]) => {
  const previous = [...sink.getMessages()];
  const next = messages.map(normalizeMessageResults);
  for (const [index, message] of next.entries()) {
    const current = previous[index];
    if (current?.id === message.id) {
      if (JSON.stringify(current) !== JSON.stringify(message)) {
        sink.push({ op: "replace", path: `/messages/${index}`, value: message });
        previous[index] = message;
      }
      continue;
    }
    const existing = previous.findIndex((candidate, position) => position > index && candidate.id === message.id);
    if (existing >= 0) {
      sink.push({ op: "remove", path: `/messages/${existing}` });
      previous.splice(existing, 1);
    }
    sink.push({ op: "add", path: `/messages/${index}`, value: message });
    previous.splice(index, 0, message);
  }
  for (let index = previous.length - 1; index >= next.length; index--)
    sink.push({ op: "remove", path: `/messages/${index}` });
};
