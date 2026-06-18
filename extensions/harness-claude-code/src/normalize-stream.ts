import type { SessionMessage } from "@pstdio/sdk/extensions";
import { classifyToolAction, normalizeErrorPart } from "./message-parts";
import type { ClaudeCodeContentBlock, RawLogEvent } from "./types";
import { parseStdoutLine } from "./types";
import { parseTimestamp } from "./utils";

type StreamContext = { index: number; toolMap: Map<string, string> };

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
    const tool = block.name as string;
    const callId = block.id as string;
    ctx.toolMap.set(callId, tool);
    return {
      id: `stream-tool-${ctx.index}`,
      role: "assistant",
      parts: [
        {
          type: "tool",
          tool,
          callId,
          actionType: classifyToolAction(tool),
          status: "pending",
          state: { input: block.input },
        },
      ],
      index: ctx.index,
    };
  }

  if (block.type === "tool_result") {
    const callId = block.tool_use_id as string;
    const tool = ctx.toolMap.get(callId) ?? "unknown";
    const isError = block.is_error === true;
    return {
      id: `stream-tool-result-${ctx.index}`,
      role: "assistant",
      parts: [
        {
          type: "tool",
          tool,
          callId,
          actionType: classifyToolAction(tool),
          status: isError ? "failed" : "completed",
          state: { output: block.content, errorText: isError ? "Tool execution failed" : undefined },
        },
      ],
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
    ctx.toolMap.set(block.id, block.name);
    return {
      id: `stream-assistant-tool-${ctx.index}`,
      role: "assistant",
      parts: [
        {
          type: "tool",
          tool: block.name,
          callId: block.id,
          actionType: classifyToolAction(block.name),
          status: "pending",
          state: { input: block.input },
        },
      ],
      index: ctx.index,
    };
  }

  if (block.type === "tool_result") {
    const tool = ctx.toolMap.get(block.tool_use_id) ?? "unknown";
    const isError = block.is_error === true;
    return {
      id: `stream-assistant-tool-result-${ctx.index}`,
      role: "assistant",
      parts: [
        {
          type: "tool",
          tool,
          callId: block.tool_use_id,
          actionType: classifyToolAction(tool),
          status: isError ? "failed" : "completed",
          state: { output: block.content, errorText: isError ? "Tool execution failed" : undefined },
        },
      ],
      index: ctx.index,
    };
  }

  return null;
};

const handleAssistant = (parsed: Record<string, unknown>, ctx: StreamContext): SessionMessage[] => {
  const message = parsed.message as Record<string, unknown> | undefined;
  const content = message?.content;

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

const handleResult = (parsed: Record<string, unknown>, ctx: StreamContext): SessionMessage => {
  const usage = (parsed.usage ?? {}) as Record<string, number | undefined>;
  return {
    id: `stream-result-${ctx.index}`,
    role: "system",
    parts: [
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

  if (eventType === "result") {
    return [handleResult(parsed, ctx)];
  }

  return [];
};

const timestampMessages = (messages: SessionMessage[], createdAt: number) =>
  messages.map((message) => ({ ...message, createdAt }));

export async function* normalizeClaudeCodeStream(raw: AsyncIterable<RawLogEvent>): AsyncGenerator<SessionMessage> {
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

    const createdAt = parseTimestamp(parsed.timestamp) ?? Date.now();
    for (const msg of timestampMessages(dispatchStdoutEvent(parsed, ctx), createdAt)) {
      yield msg;
      ctx.index += 1;
    }
  }
}
