import type { JsonPatch, SessionMessage, SessionMessageSender } from "pstdio-api-contracts";
import { matchesSubmittedPrompt, submittedMessageText } from "./submitted-message-identity";

// Native harnesses can replace their optimistic prompt IDs or replay the complete transcript.
// Keep host attribution with its turn, rather than assigning it to a matching old prompt.
export const createPromptSenders = () => {
  const pending: Array<{ prompt: string; sender: SessionMessageSender; after: number; deliveryId?: string }> = [];
  return {
    attributePrompt: (
      messages: SessionMessage[],
      prompt: string,
      sender?: SessionMessageSender,
      deliveryId?: string,
      afterTurn?: number,
    ) => {
      if (!sender || (sender.requestId && messages.some((message) => message.sender?.requestId === sender.requestId)))
        return () => {};
      const entry = {
        prompt: prompt.trim(),
        sender,
        after: afterTurn ?? messages.filter((message) => message.role === "user").length,
        deliveryId,
      };
      pending.push(entry);
      return () => {
        const index = pending.indexOf(entry);
        if (index !== -1) pending.splice(index, 1);
      };
    },
    apply: (messages: SessionMessage[], patch: JsonPatch) => {
      if (patch.op === "remove") return patch;
      const attribute = (message: SessionMessage, turn: number, old?: SessionMessage) => {
        if (message.role !== "user") return message;
        let index = pending.findIndex((entry) => entry.deliveryId === message.id);
        if (index === -1) {
          const text = submittedMessageText(message);
          if (old?.role === "user" && old.sender) {
            const oldText = submittedMessageText(old);
            if (matchesSubmittedPrompt(text, oldText) || matchesSubmittedPrompt(oldText, text))
              return { ...message, sender: old.sender };
          }
          index = pending.findIndex(
            (entry) => !entry.deliveryId && turn === entry.after && matchesSubmittedPrompt(text, entry.prompt),
          );
        }
        if (index === -1) return message;
        return { ...message, sender: pending.splice(index, 1)[0].sender };
      };
      if (patch.path === "/messages" && Array.isArray(patch.value)) {
        const incoming = patch.value as SessionMessage[];
        const retainedIds = new Set(incoming.map((message) => message.id));
        const previous = messages.filter((message) => message.role === "user");
        const known = new Map(previous.map((message) => [message.id, message]));
        let turn = 0;
        return {
          ...patch,
          value: incoming.map((message) => {
            if (message.role !== "user") return message;
            const previousTurn = previous[turn];
            const old =
              known.get(message.id) ?? (previousTurn && !retainedIds.has(previousTurn.id) ? previousTurn : undefined);
            return attribute(message, turn++, old);
          }),
        };
      }
      const match = /^\/messages\/(\d+)$/.exec(patch.path);
      if (!match) return patch;
      const message = patch.value as SessionMessage;
      if (message.role !== "user") return patch;
      const position = Number(match[1]);
      const turn = messages.slice(0, position).filter((item) => item.role === "user").length;
      // Reattached harnesses can replay a checkpointed ID as an add. A new ID
      // can inherit positional metadata only when it actually replaces that row.
      const old =
        messages.find((item) => item.id === message.id) ?? (patch.op === "replace" ? messages[position] : undefined);
      return { ...patch, value: attribute(message, turn, old) };
    },
  };
};
