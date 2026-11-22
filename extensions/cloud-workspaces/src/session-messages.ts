import type { ConversationMessageInput, ConversationPart } from "@pstdio/pocketcoder-sdk";
import type { SessionMessage, SessionMessagePart } from "@pstdio/sdk/extensions";

export function sessionMessages(messages: ConversationMessageInput[], urls: Record<string, string> = {}) {
  return messages
    .filter((message) => message.identity?.fact?.type !== "turn_terminal")
    .map(
      (message, index) =>
        ({
          id: message.message_id,
          role: message.role,
          index,
          createdAt: Date.parse(message.occurred_at),
          parts: (message.parts ?? [{ type: "text", text: message.content }]).map((value) => part(value, urls)),
        }) satisfies SessionMessage,
    );
}

function part(value: ConversationPart, urls: Record<string, string>) {
  if (value.type === "tool")
    return {
      type: "tool",
      tool: value.name,
      callId: value.call_id,
      status: value.status === "canceled" ? "failed" : value.status,
      state: { status: value.status, input: value.input, output: value.output_text ?? value.output },
    } satisfies SessionMessagePart;
  if (value.type === "error")
    return { type: "error", errorType: "other", message: value.message } satisfies SessionMessagePart;
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
      } satisfies SessionMessagePart;
    return { type: "text", text: `File: ${value.name} (${value.size_bytes} bytes)` } satisfies SessionMessagePart;
  }
  return value;
}

type MessageRequest = <T>(path: string) => Promise<T>;
type OpenTurn = { conversation_id: string; turn_id: string; messages: ConversationMessageInput[] };

function trackDepartures(
  previous: Map<string, OpenTurn>,
  current: Map<string, OpenTurn>,
  pending: Map<string, OpenTurn>,
) {
  for (const [id, turn] of previous) if (!current.has(id)) pending.set(id, turn);
  for (const id of current.keys()) pending.delete(id);
}

function confirmCommits(pending: Map<string, OpenTurn>, stored: Map<string, ConversationMessageInput>) {
  if (!pending.size) return false;
  const committed = new Set(
    [...stored.values()].flatMap((message) => (message.identity ? [message.identity.turn_id] : [])),
  );
  let changed = false;
  for (const id of pending.keys()) {
    if (committed.has(id)) {
      pending.delete(id);
      changed = true;
    }
  }
  return changed;
}

export function createSessionMessageReader(
  request: MessageRequest,
  workspaceId: string,
  conversationId: string,
  fileUrl?: (id: string) => Promise<string | undefined>,
) {
  const base = `/v1/workspaces/${workspaceId}`;
  let stored: Map<string, ConversationMessageInput> | undefined;
  let previousSignature: string | undefined;
  let previousTurns = new Map<string, OpenTurn>();
  const pending = new Map<string, OpenTurn>();
  return async (refreshHistory = false) => {
    const open = await request<{ turns: OpenTurn[] }>(
      `${base}/conversation/open?conversationId=${encodeURIComponent(conversationId)}`,
    );
    const turns = open.turns.filter((turn) => turn.conversation_id === conversationId);
    const currentTurns = new Map(turns.map((turn) => [turn.turn_id, turn]));
    trackDepartures(previousTurns, currentTurns, pending);
    const signature = JSON.stringify(turns);
    const first = !stored;
    const canonical = first || refreshHistory || pending.size > 0;
    if (!canonical && signature === previousSignature) return;
    if (canonical) stored = await storedMessages(request, `${base}/conversations/${conversationId}`);
    const committed = confirmCommits(pending, stored!);
    const changed = first || refreshHistory || committed || signature !== previousSignature;
    previousSignature = signature;
    previousTurns = currentTurns;
    if (!changed) return;
    const messages = new Map<string, ConversationMessageInput>();
    // Eviction precedes durable commit. Keep the last live snapshot until its
    // turn identity is visible in saved rows, including across empty polls.
    for (const turn of [...pending.values(), ...turns])
      for (const message of turn.messages) messages.set(message.message_id, message);
    // Durable rows always win, including across separately sampled live snapshots.
    for (const [id, message] of stored!) messages.set(id, message);
    const values = [...messages.values()];
    const urls = await fileUrls(values, fileUrl);
    return sessionMessages(
      values.sort(
        (a, b) =>
          Date.parse(a.occurred_at) - Date.parse(b.occurred_at) ||
          (a.identity?.sequence ?? 0) - (b.identity?.sequence ?? 0),
      ),
      urls,
    );
  };
}

async function storedMessages(request: MessageRequest, path: string) {
  const messages = new Map<string, ConversationMessageInput>();
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ limit: "200" });
    if (cursor) query.set("cursor", cursor);
    const page: { items: ConversationMessageInput[]; next_cursor: string | null } = await request<{
      items: ConversationMessageInput[];
      next_cursor: string | null;
    }>(`${path}?${query}`).catch((error) => {
      if (error && typeof error === "object" && "code" in error && error.code === "conversation.not_found")
        return { items: [], next_cursor: null };
      throw error;
    });
    for (const message of page.items) messages.set(message.message_id, message);
    cursor = page.next_cursor;
  } while (cursor);
  return messages;
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
