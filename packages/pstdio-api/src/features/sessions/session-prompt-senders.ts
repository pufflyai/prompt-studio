import { type JsonPatch, type SessionMessage, type SessionMessageSender, submittedPrompt } from "pstdio-api-contracts";

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
      const previous = messages.filter((message) => message.role === "user");
      const known = new Map(messages.map((message) => [message.id, message]));
      const attribute = (message: SessionMessage, turn: number) => {
        if (message.role !== "user") return message;
        const old = known.get(message.id) ?? previous[turn];
        if (old?.sender && submittedPrompt(old) === submittedPrompt(message)) return { ...message, sender: old.sender };
        const index = pending.findIndex((entry) =>
          entry.deliveryId
            ? entry.deliveryId === message.id
            : turn === entry.after && entry.prompt === submittedPrompt(message),
        );
        if (index === -1) return message;
        return { ...message, sender: pending.splice(index, 1)[0].sender };
      };
      if (patch.path === "/messages" && Array.isArray(patch.value)) {
        let turn = 0;
        return {
          ...patch,
          value: (patch.value as SessionMessage[]).map((message) =>
            attribute(message, message.role === "user" ? turn++ : turn),
          ),
        };
      }
      const match = /^\/messages\/(\d+)$/.exec(patch.path);
      if (!match) return patch;
      const turn = messages.slice(0, Number(match[1])).filter((message) => message.role === "user").length;
      return { ...patch, value: attribute(patch.value as SessionMessage, turn) };
    },
  };
};
