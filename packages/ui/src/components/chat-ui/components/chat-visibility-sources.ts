import type { SessionMessage } from "./message-types";

/** Projection combines tool rows while preserving the original content parts. */
export const chatVisibilitySourceIds = (messages: SessionMessage[], displayed: SessionMessage[]) => {
  const origins = new Map<SessionMessage["parts"][number], string[]>();
  for (const message of messages)
    for (const part of message.parts) origins.set(part, [...(origins.get(part) ?? []), message.id]);
  const rows = new Map(
    displayed.map((message) => [message.id, [...new Set(message.parts.flatMap((part) => origins.get(part) ?? []))]]),
  );
  return (visible: string[]) => [...new Set(visible.flatMap((id) => rows.get(id) ?? []))];
};
