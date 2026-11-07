// The reducer accepts canonical service messages and UI messages with presentation-only parts.
interface PatchableSessionMessage {
  id: string;
  role: string;
  animationKey?: string;
  createdAt?: number;
  parts: readonly { type: string; text?: string }[];
}

export interface SessionMessagePatch {
  op: "add" | "replace" | "remove";
  path: string;
  value?: unknown;
}

const promptText = (message: PatchableSessionMessage) =>
  message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");

const retainUserMessageIdentity = <Message extends PatchableSessionMessage>(
  previous: Message | undefined,
  message: Message,
) => {
  if (!previous || message.animationKey) return message;
  if (previous.id === message.id)
    return previous.animationKey ? { ...message, animationKey: previous.animationKey } : message;
  if (
    previous.role !== "user" ||
    message.role !== "user" ||
    previous.createdAt === undefined ||
    previous.createdAt !== message.createdAt ||
    promptText(previous) !== promptText(message)
  )
    return message;
  // Harnesses can replace their own optimistic echo after the dashboard's pending send has cleared.
  return { ...message, animationKey: previous.animationKey ?? previous.id };
};

export const applySessionMessagePatch = <Message extends PatchableSessionMessage>(
  messages: Message[],
  patch: SessionMessagePatch,
) => {
  if (patch.path === "/messages" && (patch.op === "add" || patch.op === "replace")) {
    if (!Array.isArray(patch.value)) return messages;
    const incoming = patch.value as Message[];
    const known = new Map(messages.map((message) => [message.id, message]));
    const incomingIds = new Set(incoming.map((message) => message.id));
    return incoming.map((message, index) => {
      let previous = known.get(message.id);
      if (!previous && !incomingIds.has(messages[index]?.id)) previous = messages[index];
      return retainUserMessageIdentity(previous, message);
    });
  }
  const match = patch.path.match(/^\/messages\/(\d+)$/);
  if (!match) return messages;
  const index = Number(match[1]);
  const limit = patch.op === "add" ? messages.length : messages.length - 1;
  if (index > limit || !Number.isSafeInteger(index)) return messages;
  const next = [...messages];
  if (patch.op === "add") next.splice(index, 0, patch.value as Message);
  else if (patch.op === "replace") next[index] = retainUserMessageIdentity(messages[index], patch.value as Message);
  else next.splice(index, 1);
  return next;
};
