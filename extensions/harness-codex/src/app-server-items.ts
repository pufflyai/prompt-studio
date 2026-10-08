import type { RpcMessage } from "./app-server-rpc";
import { type AsyncUserInputQuestion, asyncQuestionItem } from "./async-question-items";
import type { CodexThreadItem, CodexUsage } from "./types";

interface NativeItem {
  id: string;
  type: string;
  text?: string;
  summary?: string[];
  command?: string;
  aggregatedOutput?: string;
  exitCode?: number | null;
  status?: string;
  changes?: Array<{ path: string; kind: { type: string } }>;
  server?: string;
  tool?: string;
  query?: string;
  result?: unknown;
  delivery?: string | null;
  questions?: AsyncUserInputQuestion[] | null;
  clientId?: string | null;
  content?: Array<{ type: string; text?: string }>;
}

const toThreadItem = (native: NativeItem) => {
  if (native.type === "agentMessage" && native.delivery === "async" && native.questions?.length) {
    return asyncQuestionItem(native.id, native.questions);
  }
  const types: Record<string, string> = {
    agentMessage: "agent_message",
    userMessage: "user_message",
    reasoning: "reasoning",
    commandExecution: "command_execution",
    fileChange: "file_change",
    mcpToolCall: "mcp_tool_call",
    webSearch: "web_search",
  };
  if (!types[native.type]) return undefined;
  return {
    id: native.id,
    type: types[native.type],
    text:
      native.type === "reasoning"
        ? native.summary?.join("\n")
        : (native.text ?? native.content?.map((part) => part.text ?? "").join("")),
    command: native.command,
    aggregated_output:
      native.type === "mcpToolCall" && native.result !== undefined
        ? JSON.stringify(native.result)
        : native.aggregatedOutput,
    exit_code: native.exitCode,
    status: native.status,
    changes: native.changes?.map((change) => ({ path: change.path, kind: change.kind.type })),
    server: native.server,
    tool: native.tool,
    query: native.query,
  };
};

const planItem = (params: Record<string, unknown>) => {
  const plan = params.plan as Array<{ step: string; status: string }>;
  return {
    id: `plan-${params.turnId}`,
    type: "todo_list",
    status: plan.every((step) => step.status === "completed") ? "completed" : "in_progress",
    items: plan.map((step) => ({ text: step.step, completed: step.status === "completed" })),
  };
};

export const createAppServerItems = (publish: (item: CodexThreadItem) => void, initialUserMessageId?: string) => {
  const items = new Map<string, CodexThreadItem>();
  let usage: CodexUsage | undefined;
  const publishNativeItem = (native: NativeItem) => {
    // The initial prompt already carries host attachments; only later native user messages are added.
    if (native.type === "userMessage" && initialUserMessageId && native.clientId === initialUserMessageId) return;
    const item = toThreadItem(native);
    if (!item) return;
    items.set(item.id, item);
    publish(item);
  };
  const receive = (message: RpcMessage) => {
    const params = message.params ?? {};
    if (message.method === "turn/plan/updated") {
      publish(planItem(params));
    }
    if (message.method === "thread/tokenUsage/updated") {
      const last = (
        params.tokenUsage as { last?: { inputTokens: number; cachedInputTokens: number; outputTokens: number } }
      )?.last;
      if (last)
        usage = {
          input_tokens: last.inputTokens,
          cached_input_tokens: last.cachedInputTokens,
          output_tokens: last.outputTokens,
        };
    }
    if (message.method === "item/started" || message.method === "item/completed") {
      publishNativeItem(params.item as NativeItem);
    }
    const deltaFields: Record<string, "text" | "aggregated_output"> = {
      "item/agentMessage/delta": "text",
      "item/reasoning/summaryTextDelta": "text",
      "item/commandExecution/outputDelta": "aggregated_output",
    };
    const field = deltaFields[message.method ?? ""];
    const item = items.get(String(params.itemId));
    if (field && item && typeof params.delta === "string") {
      item[field] = (item[field] ?? "") + params.delta;
      publish(item);
    }
  };
  return { receive, getUsage: () => usage };
};
