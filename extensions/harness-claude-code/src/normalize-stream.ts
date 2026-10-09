import type { SessionMessage } from "@pstdio/sdk/extensions";
import { apiErrorPart, normalizeErrorPart, toolResultPart, toolUsePart } from "./message-parts";
import type { ClaudeCodeContentBlock, ClaudeCodeToolResultBlock, ClaudeCodeToolUseBlock, RawLogEvent } from "./types";
import { parseStdoutLine } from "./types";
import { parseTimestamp } from "./utils";

type StreamContext = { index: number; toolMap: Map<string, string>; localReply?: boolean };

const trackToolUse = (block: ClaudeCodeToolUseBlock, ctx: StreamContext) => {
  const part = toolUsePart(block);
  ctx.toolMap.set(block.id, part.tool);
  return part;
};

const trackedToolResult = (block: ClaudeCodeToolResultBlock, ctx: StreamContext, toolUseResult?: unknown) =>
  toolResultPart(ctx.toolMap.get(block.tool_use_id) ?? "unknown", block, toolUseResult);

const handleContentBlockDelta = (parsed: Record<string, unknown>, ctx: StreamContext): SessionMessage | null => {
  const delta = parsed.delta as Record<string, unknown> | undefined;
  if (!delta) return null;

  if (delta.type === "text_delta") {
    return {
      id: `stream-text-${ctx.index}`,
      role: "assistant",
      parts: [{ type: "text", text: delta.text as string }],
      index: ctx.index,
    };
  }

  if (delta.type === "thinking_delta") {
    return {
      id: `stream-reasoning-${ctx.index}`,
      role: "assistant",
      parts: [{ type: "reasoning", text: delta.thinking as string }],
      index: ctx.index,
    };
  }

  return null;
};

const handleContentBlockStart = (parsed: Record<string, unknown>, ctx: StreamContext): SessionMessage | null => {
  const block = parsed.content_block as Record<string, unknown> | undefined;
  if (!block) return null;

  if (block.type === "tool_use") {
    return {
      id: `stream-tool-${ctx.index}`,
      role: "assistant",
      parts: [trackToolUse(block as ClaudeCodeToolUseBlock, ctx)],
      index: ctx.index,
    };
  }

  if (block.type === "tool_result") {
    return {
      id: `stream-tool-result-${ctx.index}`,
      role: "assistant",
      parts: [trackedToolResult(block as ClaudeCodeToolResultBlock, ctx)],
      index: ctx.index,
    };
  }

  if (block.type === "thinking") {
    return {
      id: `stream-thinking-${ctx.index}`,
      role: "assistant",
      parts: [{ type: "reasoning", text: "" }],
      index: ctx.index,
    };
  }

  return null;
};

const contentBlockToMessage = (block: ClaudeCodeContentBlock, ctx: StreamContext): SessionMessage | null => {
  if (block.type === "text") {
    return {
      id: `stream-assistant-text-${ctx.index}`,
      role: "assistant",
      parts: [{ type: "text", text: block.text }],
      index: ctx.index,
    };
  }

  if (block.type === "thinking") {
    return {
      id: `stream-assistant-thinking-${ctx.index}`,
      role: "assistant",
      parts: [{ type: "reasoning", text: block.thinking }],
      index: ctx.index,
    };
  }

  if (block.type === "tool_use") {
    return {
      id: `stream-assistant-tool-${ctx.index}`,
      role: "assistant",
      parts: [trackToolUse(block, ctx)],
      index: ctx.index,
    };
  }

  if (block.type === "tool_result") {
    return {
      id: `stream-assistant-tool-result-${ctx.index}`,
      role: "assistant",
      parts: [trackedToolResult(block, ctx)],
      index: ctx.index,
    };
  }

  return null;
};

const handleAssistant = (parsed: Record<string, unknown>, ctx: StreamContext): SessionMessage[] => {
  const message = parsed.message as Record<string, unknown> | undefined;
  const content = message?.content;

  if (typeof parsed.error === "string") {
    return [
      {
        id: `stream-assistant-${ctx.index}`,
        role: "assistant",
        parts: [apiErrorPart(parsed.error, content)],
        index: ctx.index,
      },
    ];
  }

  if (typeof content === "string" && content.length > 0) {
    return [
      {
        id: `stream-assistant-${ctx.index}`,
        role: "assistant",
        parts: [{ type: "text", text: content }],
        index: ctx.index,
      },
    ];
  }

  if (!Array.isArray(content) || content.length === 0) return [];

  const messages: SessionMessage[] = [];
  for (const block of content as ClaudeCodeContentBlock[]) {
    const msg = contentBlockToMessage(block, ctx);
    if (msg) {
      messages.push(msg);
      ctx.index += 1;
    }
  }
  // Undo the last increment — the caller increments after each message
  if (messages.length > 0) ctx.index -= 1;
  return messages;
};

// Claude reports every tool result in a `user` event. The person's own text is already in the chat.
const handleUser = (parsed: Record<string, unknown>, ctx: StreamContext): SessionMessage[] => {
  const content = (parsed.message as Record<string, unknown> | undefined)?.content;
  if (!Array.isArray(content)) return [];

  return (content as ClaudeCodeContentBlock[])
    .filter((block): block is ClaudeCodeToolResultBlock => block.type === "tool_result")
    .map((block, offset) => ({
      id: `stream-user-tool-result-${ctx.index + offset}`,
      role: "assistant",
      parts: [trackedToolResult(block, ctx, parsed.tool_use_result)],
      index: ctx.index + offset,
    }));
};

const handleResult = (parsed: Record<string, unknown>, ctx: StreamContext): SessionMessage => {
  const usage = (parsed.usage ?? {}) as Record<string, number | undefined>;
  return {
    id: `stream-result-${ctx.index}`,
    role: "system",
    parts: [
      ...(parsed.local_command && typeof parsed.result === "string" && !ctx.localReply
        ? [{ type: "text" as const, text: parsed.result || "Native compaction completed." }]
        : []),
      ...(parsed.is_error
        ? [normalizeErrorPart({ message: typeof parsed.result === "string" ? parsed.result : undefined })]
        : []),
      {
        type: "token_usage",
        inputTokens: usage.input_tokens ?? 0,
        outputTokens: usage.output_tokens ?? 0,
        cacheReadTokens: usage.cache_read_input_tokens,
        cacheWriteTokens: usage.cache_creation_input_tokens,
      },
    ],
    index: ctx.index,
  };
};

const dispatchStdoutEvent = (parsed: Record<string, unknown>, ctx: StreamContext): SessionMessage[] => {
  const eventType = parsed.type as string;

  if (eventType === "content_block_delta") {
    const msg = handleContentBlockDelta(parsed, ctx);
    return msg ? [msg] : [];
  }

  if (eventType === "content_block_start") {
    const msg = handleContentBlockStart(parsed, ctx);
    return msg ? [msg] : [];
  }

  if (eventType === "assistant") {
    return handleAssistant(parsed, ctx);
  }

  if (eventType === "user") {
    return handleUser(parsed, ctx);
  }

  if (eventType === "result") {
    return [handleResult(parsed, ctx)];
  }

  return [];
};

const timestampMessages = (messages: SessionMessage[], createdAt: number) =>
  messages.map((message) => ({ ...message, createdAt }));

export async function* normalizeClaudeCodeStream(
  raw: AsyncIterable<RawLogEvent>,
  options: { compact?: boolean } = {},
): AsyncGenerator<SessionMessage> {
  const ctx: StreamContext = { index: 0, toolMap: new Map() };

  for await (const event of raw) {
    if (event.type === "stderr") {
      yield {
        id: `stream-error-${ctx.index}`,
        role: "system",
        createdAt: Date.now(),
        parts: [normalizeErrorPart({ message: event.data })],
        index: ctx.index,
      };
      ctx.index += 1;
      continue;
    }

    if (event.type !== "stdout") continue;

    const parsed = parseStdoutLine(event.data);
    if (!parsed) continue;
    if (options.compact && parsed.type === "assistant") continue;
    if (parsed.local_command_source) ctx.localReply = true;

    const createdAt = parseTimestamp(parsed.timestamp) ?? Date.now();
    for (const msg of timestampMessages(dispatchStdoutEvent(parsed, ctx), createdAt)) {
      yield msg;
      ctx.index += 1;
    }
  }
}
