import type { SessionMessage } from "@pstdio/sdk/extensions";
import { type AsyncUserInputQuestion, asyncQuestionItem } from "./async-question-items";
import { itemToMessage } from "./items";
import type { CodexThreadItem } from "./types";

type RolloutText = { type?: string; text?: string };

export type RolloutItem = {
  type?: string;
  id?: string;
  content?: RolloutText[];
  summary_text?: string[];
  command?: string[];
  aggregated_output?: string;
  exit_code?: number | null;
  status?: string;
  changes?: Record<string, { type?: string }>;
  server?: string;
  tool?: string;
  query?: string;
  delivery?: string | null;
  questions?: AsyncUserInputQuestion[] | null;
};

const joinText = (content: RolloutText[] | undefined) => (content ?? []).map((part) => part.text ?? "").join("");

// The rollout stores each completed item in Codex's own format. Converting it to the
// `codex exec --json` item the live stream received lets both sources share itemToMessage.
const toThreadItem = (item: RolloutItem): CodexThreadItem | null => {
  const id = item.id ?? "";
  switch (item.type) {
    case "AgentMessage":
      if (item.delivery === "async" && item.questions?.length) return asyncQuestionItem(id, item.questions);
      return { id, type: "agent_message", text: joinText(item.content) };
    case "Reasoning": {
      const text = (item.summary_text ?? []).join("\n");
      return text ? { id, type: "reasoning", text } : null;
    }
    case "CommandExecution":
      return {
        id,
        type: "command_execution",
        command: item.command,
        aggregated_output: item.aggregated_output,
        exit_code: item.exit_code,
        status: item.status,
      };
    case "FileChange":
      return {
        id,
        type: "file_change",
        changes: Object.entries(item.changes ?? {}).map(([path, change]) => ({ path, kind: change.type })),
        status: item.status,
      };
    case "McpToolCall":
      return { id, type: "mcp_tool_call", server: item.server, tool: item.tool, status: item.status };
    case "WebSearch":
      return { id, type: "web_search", query: item.query };
    default:
      return null;
  }
};

export const rolloutItemMessage = (item: RolloutItem, createdAt: number | undefined): SessionMessage | null => {
  if (item.type === "UserMessage") {
    const text = joinText(item.content);
    return text ? { id: `rollout-${item.id}`, role: "user", parts: [{ type: "text", text }], createdAt } : null;
  }
  const threadItem = toThreadItem(item);
  const message = threadItem && itemToMessage(threadItem, "rollout");
  return message ? { ...message, createdAt } : null;
};
