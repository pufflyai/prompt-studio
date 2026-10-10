import type { SessionMessage } from "@pstdio/ui/chat-ui";

export interface DashboardSessionMessagePatch {
  op: "add" | "replace" | "remove";
  path: string;
  value?: unknown;
}

export const visibleSessionMessages = (messages: readonly SessionMessage[]) =>
  messages.flatMap((message) => {
    const parts = message.parts.filter(
      (part) => !((part.type === "text" || part.type === "reasoning") && !part.text.trim()),
    );
    return parts.length ? [{ ...message, parts }] : [];
  });

export const applyDashboardSessionMessagePatch = (messages: SessionMessage[], patch: DashboardSessionMessagePatch) => {
  if (patch.path === "/messages" && (patch.op === "add" || patch.op === "replace")) {
    return Array.isArray(patch.value) ? (patch.value as SessionMessage[]) : messages;
  }
  const match = patch.path.match(/^\/messages\/(\d+)$/);
  if (!match) return messages;
  const index = Number(match[1]);
  const limit = patch.op === "add" ? messages.length : messages.length - 1;
  if (index > limit || !Number.isSafeInteger(index)) return messages;
  const next = [...messages];
  if (patch.op === "add") next.splice(index, 0, patch.value as SessionMessage);
  else if (patch.op === "replace") next[index] = patch.value as SessionMessage;
  else next.splice(index, 1);
  return next;
};
