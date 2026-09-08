import type { SessionMessage, SessionMessageRole } from "@pstdio/sdk/extensions";
import { getWorkspace, isTerminal, type PocketCoderContext, request, workspacePath } from "./pocketcoder";

export interface AgentMessage {
  id: number;
  role: string;
  content: string;
}

export const isAssistant = (message: AgentMessage) => message.role === "agent" || message.role === "assistant";

export const readAgentMessages = async (ctx: PocketCoderContext, id: string, signal?: AbortSignal) => {
  const response = await request<{ messages: AgentMessage[] }>(ctx, {
    method: "GET",
    path: `${workspacePath(id)}/agent/messages`,
    signal,
  });
  return response.messages;
};

export const normalizeMessages = (id: string, messages: AgentMessage[]) =>
  messages.map(
    (message, index) =>
      ({
        id: `pocketcoder:${id}:${message.id}`,
        role: (isAssistant(message) ? "assistant" : message.role) as SessionMessageRole,
        parts: [{ type: "text", text: message.content }],
        index,
      }) satisfies SessionMessage,
  );

interface ConversationPage {
  items: { message_id: string; seq: number; role: SessionMessageRole; content: string; occurred_at: string }[];
  next_cursor: string | null;
}

export const readConversation = async (ctx: PocketCoderContext, id: string, signal?: AbortSignal) => {
  const messages: SessionMessage[] = [];
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ limit: "200" });
    if (cursor) query.set("cursor", cursor);
    const page: ConversationPage = await request(ctx, {
      method: "GET",
      path: `${workspacePath(id)}/conversation?${query}`,
      signal,
    });
    for (const message of page.items)
      messages.push({
        id: `pocketcoder:${id}:${message.message_id}`,
        role: message.role,
        parts: [{ type: "text", text: message.content }],
        index: messages.length,
        createdAt: Date.parse(message.occurred_at),
      });
    cursor = page.next_cursor;
  } while (cursor);
  return messages;
};

export const getMessages = async (ctx: PocketCoderContext, id: string) => {
  const workspace = await getWorkspace(ctx, id);
  if (isTerminal(workspace)) return readConversation(ctx, id);
  return normalizeMessages(id, await readAgentMessages(ctx, id));
};
