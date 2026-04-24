import { parseStdoutLine } from "../../parse-stdout-line";
import type { RawLogEvent, SessionMessage, SessionMessageRole, ToolPartActionType } from "../../types";
import { normalizeErrorPart } from "../normalized-error";
import type { ClaudeCodeContentBlock, ClaudeCodeTranscriptEntry } from "./claude-code-types";

// --- Tool classification ---

const READ_TOOLS = new Set(["Read", "Glob", "Grep"]);
const WRITE_TOOLS = new Set(["Write", "Edit", "NotebookEdit", "TodoWrite"]);
const EXECUTE_TOOLS = new Set(["Bash", "Task"]);
const NETWORK_TOOLS = new Set(["WebFetch", "WebSearch"]);

const classifyToolAction = (toolName: string): ToolPartActionType => {
  if (READ_TOOLS.has(toolName)) return "read";
  if (WRITE_TOOLS.has(toolName)) return "write";
  if (EXECUTE_TOOLS.has(toolName)) return "execute";
  if (NETWORK_TOOLS.has(toolName)) return "network";
  return "other";
};

export const mergeToolResultMessage = (previous: SessionMessage, message: SessionMessage): SessionMessage => {
  const previousPart = previous.parts[0];
  const nextPart = message.parts[0];

  if (previousPart?.type !== "tool" || nextPart?.type !== "tool") return message;

  const previousState = previousPart.state;
  const nextState = nextPart.state;
  const state =
    previousState || nextState
      ? {
          ...previousState,
          ...nextState,
          input: nextState?.input ?? previousState?.input,
        }
      : undefined;

  return {
    ...message,
    parts: [
      {
        ...nextPart,
        state,
      },
    ],
  };
};

// --- Batch normalizer (transcript reading) ---

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
  toolUseResult?: unknown,
): SessionMessage | null => {
  if (block.type === "text") {
    if (!block.text.trim()) return null;
    return { id, role, parts: [{ type: "text", text: block.text }] };
  }

  if (block.type === "thinking") {
    return { id, role: "assistant", parts: [{ type: "reasoning", text: block.thinking }] };
  }

  if (block.type === "tool_use") {
    toolMap.set(block.id, block.name);
    return {
      id,
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
    };
  }

  if (block.type === "tool_result") {
    const tool = toolMap.get(block.tool_use_id) ?? "unknown";
    const isError = block.is_error === true;
    const output =
      toolUseResult && typeof toolUseResult === "object" && !Array.isArray(toolUseResult)
        ? { ...toolUseResult, returnDisplay: block.content }
        : block.content;

    return {
      id,
      role: "assistant",
      parts: [
        {
          type: "tool",
          tool,
          callId: block.tool_use_id,
          actionType: classifyToolAction(tool),
          status: isError ? "failed" : "completed",
          state: { output, errorText: isError ? "Tool execution failed" : undefined },
        },
      ],
    };
  }

  return null;
};

const toTranscriptMessages = (entry: ClaudeCodeTranscriptEntry, toolMap: Map<string, string>) => {
  const role = resolveRole(entry);
  const content = entry.message.content;

  if (typeof content === "string") {
    if (!content.trim()) return [];
    return [{ id: entry.uuid, role, parts: [{ type: "text" as const, text: content }] } satisfies SessionMessage];
  }

  if (!Array.isArray(content)) return [];

  const messages: SessionMessage[] = [];
  for (let i = 0; i < content.length; i++) {
    const msg = transcriptBlockToMessage(content[i], `${entry.uuid}-${i}`, role, toolMap, entry.toolUseResult);
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

// --- Stream normalizer (live events) ---

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

export async function* normalizeClaudeCodeStream(raw: AsyncIterable<RawLogEvent>): AsyncGenerator<SessionMessage> {
  const ctx: StreamContext = { index: 0, toolMap: new Map() };

  for await (const event of raw) {
    if (event.type === "stderr") {
      yield {
        id: `stream-error-${ctx.index}`,
        role: "system",
        parts: [normalizeErrorPart({ message: event.data })],
        index: ctx.index,
      };
      ctx.index += 1;
      continue;
    }

    if (event.type !== "stdout") continue;

    const parsed = parseStdoutLine(event.data);
    if (!parsed) continue;

    for (const msg of dispatchStdoutEvent(parsed, ctx)) {
      yield msg;
      ctx.index += 1;
    }
  }
}
