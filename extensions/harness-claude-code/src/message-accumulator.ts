import type { HarnessEventSink, SessionMessage } from "@pstdio/sdk/extensions";
import { mergeToolResultMessage } from "./message-parts";

type AccumulatorOptions = {
  initialMessages?: SessionMessage[];
  indexOffset?: number;
  pushInitialMessages?: boolean;
};

export const createMessageAccumulator = (sink: HarnessEventSink, options: AccumulatorOptions = {}) => {
  const messages: SessionMessage[] = [...(options.initialMessages ?? [])];
  const toolCalls = new Map<string, number>();
  const offset = options.indexOffset ?? 0;

  const toPath = (idx: number) => `/messages/${offset + idx}`;

  if (options.pushInitialMessages) {
    for (let i = 0; i < messages.length; i++) {
      sink.push({ op: "add", path: toPath(i), value: messages[i] });
    }
  }

  const push = (message: SessionMessage) => {
    const firstPart = message.parts[0];
    if (!firstPart) return;

    // Tool result replaces pending tool_use at same index
    if (firstPart.type === "tool" && firstPart.callId && firstPart.status !== "pending") {
      const existingIdx = toolCalls.get(firstPart.callId);

      if (existingIdx !== undefined) {
        const merged = mergeToolResultMessage(messages[existingIdx], message);
        messages[existingIdx] = merged;
        sink.push({ op: "replace", path: toPath(existingIdx), value: merged });
        return;
      }
    }

    // Track pending tool calls for later replacement
    if (firstPart.type === "tool" && firstPart.callId && firstPart.status === "pending") {
      toolCalls.set(firstPart.callId, messages.length);
    }

    // Accumulate consecutive text with same role
    const lastIdx = messages.length - 1;
    const lastMessage = messages[lastIdx];
    const lastPart = lastMessage?.parts[0];

    if (firstPart.type === "text" && lastPart?.type === "text" && message.role === lastMessage.role) {
      const updated = { ...lastMessage, parts: [{ ...lastPart, text: lastPart.text + firstPart.text }] };
      messages[lastIdx] = updated;
      sink.push({ op: "replace", path: toPath(lastIdx), value: updated });
      return;
    }

    // Accumulate consecutive reasoning with same role
    if (firstPart.type === "reasoning" && lastPart?.type === "reasoning" && message.role === lastMessage.role) {
      const updated = { ...lastMessage, parts: [{ ...lastPart, text: lastPart.text + firstPart.text }] };
      messages[lastIdx] = updated;
      sink.push({ op: "replace", path: toPath(lastIdx), value: updated });
      return;
    }

    // Default: append
    messages.push(message);
    sink.push({ op: "add", path: toPath(messages.length - 1), value: message });
  };

  return { push };
};
