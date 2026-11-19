import type { ConversationMessageInput, ConversationPart } from "@pstdio/pocketcoder-sdk";
import type { SessionMessage, SessionMessagePart } from "@pstdio/sdk/extensions";

export function sessionMessages(
  messages: ConversationMessageInput[],
  urls: Record<string, string> = {},
): SessionMessage[] {
  return messages
    .filter((message) => message.identity?.fact?.type !== "turn_terminal")
    .map((message, index) => ({
      id: message.message_id,
      role: message.role,
      index,
      createdAt: Date.parse(message.occurred_at),
      parts: (message.parts ?? [{ type: "text", text: message.content }]).map((value) => part(value, urls)),
    }));
}

function part(value: ConversationPart, urls: Record<string, string>): SessionMessagePart {
  if (value.type === "tool")
    return {
      type: "tool",
      tool: value.name,
      callId: value.call_id,
      status: value.status === "canceled" ? "failed" : value.status,
      state: { status: value.status, input: value.input, output: value.output_text ?? value.output },
    };
  if (value.type === "error") return { type: "error", errorType: "other", message: value.message };
  if (value.type === "file") {
    const url = urls[value.file_id];
    if (url)
      return {
        type: "file",
        fileId: value.file_id,
        filename: value.name,
        mediaType: value.media_type,
        size: value.size_bytes,
        url,
      };
    return { type: "text", text: `File: ${value.name} (${value.size_bytes} bytes)` };
  }
  return value;
}

export async function readSessionMessages(
  request: <T>(path: string) => Promise<T>,
  workspaceId: string,
  conversationId: string,
  fileUrl?: (id: string) => Promise<string | undefined>,
) {
  const base = `/v1/workspaces/${workspaceId}`;
  const open = await request<{ turns: { conversation_id: string; messages: ConversationMessageInput[] }[] }>(
    `${base}/conversation/open?conversationId=${encodeURIComponent(conversationId)}`,
  );
  const messages = new Map<string, ConversationMessageInput>();
  for (const turn of open.turns)
    if (turn.conversation_id === conversationId)
      for (const message of turn.messages) messages.set(message.message_id, message);
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ limit: "200" });
    if (cursor) query.set("cursor", cursor);
    const page: { items: ConversationMessageInput[]; next_cursor: string | null } = await request<{
      items: ConversationMessageInput[];
      next_cursor: string | null;
    }>(`${base}/conversations/${conversationId}?${query}`).catch((error) => {
      if (error && typeof error === "object" && "code" in error && error.code === "conversation.not_found")
        return { items: [], next_cursor: null };
      throw error;
    });
    for (const message of page.items) messages.set(message.message_id, message);
    cursor = page.next_cursor;
  } while (cursor);
  const urls = await fileUrls([...messages.values()], fileUrl);
  return sessionMessages(
    [...messages.values()].sort(
      (a, b) =>
        Date.parse(a.occurred_at) - Date.parse(b.occurred_at) ||
        (a.identity?.sequence ?? 0) - (b.identity?.sequence ?? 0),
    ),
    urls,
  );
}

async function fileUrls(messages: ConversationMessageInput[], fileUrl?: (id: string) => Promise<string | undefined>) {
  const urls: Record<string, string> = {};
  if (!fileUrl) return urls;
  for (const message of messages)
    for (const part of message.parts ?? [])
      if (part.type === "file") {
        const url = await fileUrl(part.file_id);
        if (url) urls[part.file_id] = url;
      }
  return urls;
}
