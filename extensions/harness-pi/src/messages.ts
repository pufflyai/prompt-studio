import type { SessionMessage, SessionMessagePart, ToolPart } from "@pstdio/sdk/extensions";

export interface PiContent {
  type: string;
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  arguments?: unknown;
  data?: string;
  mimeType?: string;
}

export interface PiMessage {
  role: string;
  content?: string | PiContent[];
  timestamp?: number;
  model?: string;
  provider?: string;
  toolCallId?: string;
  toolName?: string;
  isError?: boolean;
  stopReason?: string;
  errorMessage?: string;
  usage?: { input: number; output: number; cacheRead?: number; cacheWrite?: number };
  display?: boolean;
}

const contentParts = (content: PiMessage["content"]) => {
  if (typeof content === "string") return [{ type: "text", text: content }] satisfies SessionMessagePart[];
  return (content ?? []).flatMap<SessionMessagePart>((part) => {
    if (part.type === "text") return [{ type: "text", text: part.text ?? "" }];
    if (part.type === "thinking") return [{ type: "reasoning", text: part.thinking ?? "" }];
    if (part.type === "image")
      return [{ type: "file", mediaType: part.mimeType, url: `data:${part.mimeType};base64,${part.data}` }];
    if (part.type === "toolCall")
      return [
        {
          type: "tool",
          tool: part.name ?? "unknown",
          callId: part.id,
          status: "running",
          state: { input: part.arguments },
        },
      ];
    return [];
  });
};

const normalizeMessage = (message: PiMessage, index: number) => {
  const parts = contentParts(message.content);
  if (message.stopReason === "error")
    parts.push({ type: "error", errorType: "other", message: message.errorMessage ?? "Pi model request failed." });
  if (message.usage)
    parts.push({
      type: "token_usage",
      inputTokens: message.usage.input,
      outputTokens: message.usage.output,
      cacheReadTokens: message.usage.cacheRead,
      cacheWriteTokens: message.usage.cacheWrite,
    });
  return {
    id: `pi-${index}`,
    role: message.role === "user" || message.role === "assistant" ? message.role : "system",
    createdAt: message.timestamp,
    modelId: message.model,
    providerId: message.provider,
    parts,
  } satisfies SessionMessage;
};

const applyToolResult = (tool: ToolPart, message: PiMessage) => {
  tool.status = message.isError ? "failed" : "completed";
  const output = contentParts(message.content)
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n");
  tool.state = { ...tool.state, output, ...(message.isError ? { errorText: output } : {}) };
};

export const normalizePiMessages = (native: PiMessage[], offset = 0) => {
  const messages: SessionMessage[] = [];
  const tools = new Map<string, ToolPart>();
  for (const message of native) {
    if (message.role === "custom" && message.display === false) continue;
    if (message.role === "toolResult") {
      const tool = tools.get(message.toolCallId ?? "");
      if (tool) applyToolResult(tool, message);
      continue;
    }
    const normalized = normalizeMessage(message, offset + messages.length);
    for (const part of normalized.parts) if (part.type === "tool" && part.callId) tools.set(part.callId, part);
    messages.push(normalized);
  }
  return messages;
};
