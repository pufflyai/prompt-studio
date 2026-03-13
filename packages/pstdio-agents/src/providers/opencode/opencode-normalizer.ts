import type { SessionMessage, SessionMessagePart, ToolPartActionType, ToolPartStatus } from "../../types";
import type { OpencodeSessionMessage, OpencodeSessionMessagePart } from "./opencode-types";

// --- Part extraction ---

const getMessageParts = (message: OpencodeSessionMessage): OpencodeSessionMessagePart[] => {
  if ("content" in message && Array.isArray(message.content)) {
    return message.content;
  }

  if ("parts" in message && Array.isArray(message.parts)) {
    return message.parts;
  }

  return [];
};

// --- Role resolution ---

const getMessageRole = (message: OpencodeSessionMessage) => {
  if ("role" in message && message.role) {
    return message.role;
  }

  if ("info" in message && message.info?.role) {
    return message.info.role;
  }

  return "assistant";
};

const resolveRole = (role: string) => {
  if (role === "user") return "user" as const;
  if (role === "assistant") return "assistant" as const;
  if (role === "tool") return "tool" as const;
  if (role === "system") return "system" as const;
  return "assistant" as const;
};

// --- Tool classification ---

const READ_TOOLS = new Set(["glob", "read", "grep", "search"]);
const WRITE_TOOLS = new Set(["write", "edit", "patch", "notebook_edit"]);
const EXECUTE_TOOLS = new Set(["bash", "task", "shell"]);
const NETWORK_TOOLS = new Set(["web_fetch", "web_search", "fetch"]);

const classifyToolAction = (toolName: string): ToolPartActionType => {
  const lower = toolName.toLowerCase();

  if (READ_TOOLS.has(lower)) return "read";
  if (WRITE_TOOLS.has(lower)) return "write";
  if (EXECUTE_TOOLS.has(lower)) return "execute";
  if (NETWORK_TOOLS.has(lower)) return "network";

  return "other";
};

const resolveToolStatus = (status?: string): ToolPartStatus => {
  if (status === "completed") return "completed";
  if (status === "running") return "running";
  if (status === "error" || status === "failed") return "failed";
  if (status === "pending") return "pending";
  return "completed";
};

// --- Part normalization ---

const normalizePart = (part: OpencodeSessionMessagePart): SessionMessagePart | null => {
  switch (part.type) {
    case "text":
      if (typeof part.text !== "string" || part.text.trim().length === 0) return null;
      return { type: "text", text: part.text };

    case "reasoning":
      if (typeof part.text !== "string" || part.text.trim().length === 0) return null;
      return { type: "reasoning", text: part.text };

    case "tool":
      return {
        type: "tool",
        tool: part.tool ?? "unknown",
        callId: part.callID,
        actionType: classifyToolAction(part.tool ?? ""),
        status: resolveToolStatus(part.state?.status),
        state: part.state
          ? {
              status: part.state.status,
              input: part.state.input,
              output: part.state.output,
              errorText: part.state.errorText,
              metadata: part.state.metadata,
            }
          : undefined,
      };

    case "step-start":
      return { type: "step-start", snapshot: part.snapshot };

    case "step-finish":
      return {
        type: "step-finish",
        reason: part.reason,
        snapshot: part.snapshot,
        cost: part.cost,
        tokens: part.tokens,
      };

    case "patch":
      return { type: "patch", hash: part.hash, files: part.files };

    default:
      if (typeof part.text === "string" && part.text.trim().length > 0) {
        return { type: "text", text: part.text };
      }
      return null;
  }
};

// --- Message normalization ---

export const normalizeOpencodeMessage = (message: OpencodeSessionMessage, index: number): SessionMessage => {
  const role = resolveRole(getMessageRole(message));
  const parts = getMessageParts(message);

  const normalizedParts = parts.map(normalizePart).filter((p): p is SessionMessagePart => p !== null);

  const id = (() => {
    if ("info" in message && message.info?.id) {
      return message.info.id;
    }
    return `opencode-msg-${index}`;
  })();

  const tokens = (() => {
    if (!("info" in message) || !message.info?.tokens) return undefined;

    const t = message.info.tokens;
    return {
      input: t.input,
      output: t.output,
      reasoning: t.reasoning,
      cache: t.cache,
    };
  })();

  return {
    id,
    role,
    parts: normalizedParts,
    index,
    modelId: "info" in message ? message.info?.modelID : undefined,
    providerId: "info" in message ? message.info?.providerID : undefined,
    tokens,
  };
};
