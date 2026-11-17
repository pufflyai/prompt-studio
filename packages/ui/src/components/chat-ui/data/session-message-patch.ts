import type { SessionMessage } from "../components/message-types";

export { applySessionMessagePatch, type SessionMessagePatch } from "@pstdio/sdk/extensions";

export const visibleSessionMessages = (messages: readonly SessionMessage[]) =>
  messages.flatMap((message) => {
    const parts = message.parts.filter(
      (part) => !((part.type === "text" || part.type === "reasoning") && !part.text.trim()),
    );
    if (parts.length === 0) return [];
    return [parts.length === message.parts.length ? message : { ...message, parts }];
  });
