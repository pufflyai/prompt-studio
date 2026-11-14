import type { SessionMessage } from "@pstdio/ui/chat-ui";

/** Keep resolved attachments stable while other messages stream. The source owns cache lifetime. */
export const createApiFilePartsResolver = () => {
  const resolved = new WeakMap<SessionMessage, SessionMessage>();
  let previous: SessionMessage[] | undefined;
  return (messages: SessionMessage[], urls: ReadonlyMap<string, string>) => {
    if (urls.size === 0) {
      previous = undefined;
      return messages;
    }
    const next = messages.map((message) => {
      const previous = resolved.get(message);
      const parts = message.parts.map((part, index) => {
        if (part.type !== "file" || !urls.has(part.url)) return part;
        const url = urls.get(part.url)!;
        if (url === part.url) return part;
        const known = previous?.parts[index];
        return known?.type === "file" && known.url === url ? known : { ...part, url };
      });
      if (parts.every((part, index) => part === message.parts[index])) return message;
      if (previous && parts.every((part, index) => part === previous.parts[index])) return previous;
      const displayed = { ...message, parts };
      resolved.set(message, displayed);
      return displayed;
    });
    if (next.every((message, index) => message === messages[index])) {
      previous = undefined;
      return messages;
    }
    if (previous?.length === next.length && next.every((message, index) => message === previous?.[index]))
      return previous;
    previous = next;
    return next;
  };
};
