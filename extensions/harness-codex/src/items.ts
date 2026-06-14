import type { SessionMessage, ToolPart, ToolPartStatus } from "@pstdio/sdk/extensions";
import type { CodexThreadItem, CodexUsage } from "./types";

const EXECUTE_TOOLS = new Set(["shell", "exec_command", "command_execution"]);
const WRITE_TOOLS = new Set(["apply_patch", "file_change", "update_plan", "todo_list"]);
const READ_TOOLS = new Set(["read_file", "list_dir", "grep_files", "view_image"]);
const NETWORK_TOOLS = new Set(["web_search", "fetch_url"]);

export const classifyCodexTool = (toolName: string) => {
  if (EXECUTE_TOOLS.has(toolName)) return "execute";
  if (WRITE_TOOLS.has(toolName)) return "write";
  if (READ_TOOLS.has(toolName)) return "read";
  if (NETWORK_TOOLS.has(toolName)) return "network";
  return "other";
};

const toToolStatus = (item: CodexThreadItem): ToolPartStatus => {
  if (item.status === "completed") return item.exit_code == null || item.exit_code === 0 ? "completed" : "failed";
  if (item.status === "failed") return "failed";
  return "pending";
};

const toolMessage = (item: CodexThreadItem, id: string, tool: string, input: unknown): SessionMessage => {
  const status = toToolStatus(item);
  const part: ToolPart = {
    type: "tool",
    tool,
    callId: item.id,
    actionType: classifyCodexTool(tool),
    status,
    state: {
      input,
      output: item.aggregated_output,
      errorText: status === "failed" ? "Tool execution failed" : undefined,
    },
  };
  return { id, role: "assistant", parts: [part] };
};

export const itemToMessage = (item: CodexThreadItem, idPrefix: string): SessionMessage | null => {
  const id = `${idPrefix}-${item.id}`;

  if (item.type === "agent_message") {
    return { id, role: "assistant", parts: [{ type: "text", text: item.text ?? "" }] };
  }

  if (item.type === "reasoning") {
    return { id, role: "assistant", parts: [{ type: "reasoning", text: item.text ?? "" }] };
  }

  if (item.type === "command_execution") {
    return toolMessage(item, id, "shell", { command: item.command });
  }

  if (item.type === "file_change") {
    return toolMessage(item, id, "apply_patch", { changes: item.changes });
  }

  if (item.type === "mcp_tool_call") {
    return toolMessage(item, id, [item.server, item.tool].filter(Boolean).join(".") || "mcp_tool_call", undefined);
  }

  if (item.type === "web_search") {
    return toolMessage(item, id, "web_search", { query: item.query });
  }

  if (item.type === "todo_list") {
    return toolMessage(item, id, "update_plan", { items: item.items });
  }

  if (item.type === "error") {
    return { id, role: "system", parts: [{ type: "error", errorType: "other", message: item.message }] };
  }

  return null;
};

export const usageMessage = (usage: CodexUsage | undefined, id: string): SessionMessage => ({
  id,
  role: "system",
  parts: [
    {
      type: "token_usage",
      inputTokens: usage?.input_tokens ?? 0,
      outputTokens: usage?.output_tokens ?? 0,
      cacheReadTokens: usage?.cached_input_tokens,
    },
  ],
});

export const errorMessage = (message: string | undefined, id: string): SessionMessage => ({
  id,
  role: "system",
  parts: [{ type: "error", errorType: "other", message }],
});
