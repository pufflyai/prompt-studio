import type { SessionMessage, SessionMessageRole } from "@pstdio/sdk/extensions";
import { visibleClaudePrompt } from "./literal-prompt";
import { apiErrorPart, mergeToolResultMessage, toolResultPart, toolUsePart } from "./message-parts";
import type { ClaudeCodeContentBlock, ClaudeCodeTranscriptEntry } from "./types";
import { parseTimestamp } from "./utils";

const resolveRole = (entry: ClaudeCodeTranscriptEntry): SessionMessageRole => {
  const role = entry.message.role;

  if (role === "user") return "user";
  if (role === "assistant") return "assistant";
  if (role === "tool") return "tool";
  if (role === "system") return "system";

  return "assistant";
};

const transcriptBlockToMessage = (
  block: ClaudeCodeContentBlock,
  id: string,
  role: SessionMessageRole,
  toolMap: Map<string, string>,
  createdAt: number | undefined,
  toolUseResult?: unknown,
): SessionMessage | null => {
  if (block.type === "text") {
    if (!block.text.trim()) return null;
    return {
      id,
      role,
      parts: [{ type: "text", text: role === "user" ? visibleClaudePrompt(block.text) : block.text }],
      createdAt,
    };
  }

  if (block.type === "thinking") {
    return { id, role: "assistant", parts: [{ type: "reasoning", text: block.thinking }], createdAt };
  }

  if (block.type === "tool_use") {
    const part = toolUsePart(block);
    toolMap.set(block.id, part.tool);
    return { id, role: "assistant", createdAt, parts: [part] };
  }

  if (block.type === "tool_result") {
    const tool = toolMap.get(block.tool_use_id) ?? "unknown";
    return { id, role: "assistant", createdAt, parts: [toolResultPart(tool, block, toolUseResult)] };
  }

  return null;
};

const toTranscriptMessages = (entry: ClaudeCodeTranscriptEntry, toolMap: Map<string, string>) => {
  const role = resolveRole(entry);
  const content = entry.message.content;
  const createdAt = parseTimestamp(entry.timestamp);

  // Claude writes its own wake-up note as a user entry when a background task ends.
  // Showing the raw XML as a chat bubble would read as a message from the person.
  if (entry.origin?.kind === "task-notification") {
    return [
      {
        id: entry.uuid,
        role: "system",
        parts: [{ type: "text" as const, text: "Background task finished." }],
        createdAt,
      } satisfies SessionMessage,
    ];
  }

  if (typeof entry.error === "string") {
    return [{ id: entry.uuid, role, parts: [apiErrorPart(entry.error, content)], createdAt } satisfies SessionMessage];
  }

  if (typeof content === "string") {
    if (!content.trim()) return [];
    return [
      {
        id: entry.uuid,
        role,
        parts: [{ type: "text" as const, text: role === "user" ? visibleClaudePrompt(content) : content }],
        createdAt,
      } satisfies SessionMessage,
    ];
  }

  if (!Array.isArray(content)) return [];

  const messages: SessionMessage[] = [];
  for (let i = 0; i < content.length; i++) {
    const msg = transcriptBlockToMessage(
      content[i],
      `${entry.uuid}-${i}`,
      role,
      toolMap,
      createdAt,
      entry.toolUseResult,
    );
    if (msg) messages.push(msg);
  }
  return messages;
};

const pushTranscriptMessage = (messages: SessionMessage[], message: SessionMessage, toolCalls: Map<string, number>) => {
  const firstPart = message.parts[0];
  if (!firstPart) return;

  if (firstPart.type === "tool" && firstPart.callId && firstPart.status !== "pending") {
    const existingIndex = toolCalls.get(firstPart.callId);

    if (existingIndex !== undefined) {
      messages[existingIndex] = mergeToolResultMessage(messages[existingIndex], message);
      return;
    }
  }

  if (firstPart.type === "tool" && firstPart.callId && firstPart.status === "pending") {
    toolCalls.set(firstPart.callId, messages.length);
  }

  const lastMessage = messages.at(-1);
  const lastPart = lastMessage?.parts[0];

  if (lastMessage && firstPart.type === "text" && lastPart?.type === "text" && lastMessage.role === message.role) {
    const updated = {
      ...lastMessage,
      parts: [{ ...lastPart, text: lastPart.text + firstPart.text }],
    } satisfies SessionMessage;

    messages[messages.length - 1] = updated;
    return;
  }

  if (
    lastMessage &&
    firstPart.type === "reasoning" &&
    lastPart?.type === "reasoning" &&
    lastMessage.role === message.role
  ) {
    const updated = {
      ...lastMessage,
      parts: [{ ...lastPart, text: lastPart.text + firstPart.text }],
    } satisfies SessionMessage;

    messages[messages.length - 1] = updated;
    return;
  }

  messages.push(message);
};

export const normalizeClaudeCodeMessages = (entries: ClaudeCodeTranscriptEntry[]): SessionMessage[] => {
  const toolMap = new Map<string, string>();
  const toolCalls = new Map<string, number>();
  const messages: SessionMessage[] = [];

  for (const entry of entries) {
    const transcriptMessages = toTranscriptMessages(entry, toolMap);

    for (const message of transcriptMessages) {
      pushTranscriptMessage(messages, message, toolCalls);
    }
  }

  return messages.map((message, index) => ({ ...message, index }));
};
