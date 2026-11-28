import type { ChatMessageRow } from "./chat-message-rows";
import type { SessionMessage } from "./message-types";

/** Only source messages with content in a visible row can be marked as read. */
export const chatVisibilitySourceIds = (messages: SessionMessage[], rows: ChatMessageRow[]) => {
  const origins = new Map<SessionMessage["parts"][number], string[]>();
  for (const message of messages)
    for (const part of message.parts) origins.set(part, [...(origins.get(part) ?? []), message.id]);
  const sources = new Map(
    rows.map((row) => {
      const range = row.type === "response" ? row.partRange : undefined;
      const parts = range ? row.message.parts.slice(range.start, range.end) : row.message.parts;
      const ids = parts.flatMap((part) => origins.get(part) ?? []);
      // Polling prompts and errors can share one row even when their parts are separate objects.
      return [row.key, row.messageIds.length > 1 ? [...ids, ...row.messageIds.slice(1)] : ids] as const;
    }),
  );
  return (visible: string[]) => [...new Set(visible.flatMap((key) => sources.get(key) ?? []))];
};
