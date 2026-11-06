import { createToolOutputBuffer } from "@pstdio/sdk/extensions";
import type { RpcMessage } from "./app-server-rpc";
import { type AsyncUserInputQuestion, asyncQuestionItem } from "./async-question-items";
import type { CodexThreadItem, CodexUsage } from "./types";

interface NativeItem {
  id: string;
  type: string;
  text?: string;
  summary?: string[];
  command?: string;
  aggregatedOutput?: string | null;
  exitCode?: number | null;
  status?: string;
  changes?: Array<{ path: string; kind: { type: string } }>;
  server?: string;
  tool?: string;
  query?: string;
  result?: unknown;
  arguments?: unknown;
  namespace?: string | null;
  contentItems?: unknown;
  success?: boolean | null;
  name?: string;
  output?: unknown;
  delivery?: string | null;
  questions?: AsyncUserInputQuestion[] | null;
  clientId?: string | null;
  content?: Array<string | { type: string; text?: string }>;
  path?: string;
}

export const toThreadItem = (native: NativeItem) => {
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
    plan: "agent_message",
    dynamicToolCall: "mcp_tool_call",
    functionCallOutput: "mcp_tool_call",
    imageView: "image_view",
  };
  if (!types[native.type]) return undefined;
  let output: unknown = native.aggregatedOutput ?? undefined;
  let serialized = false;
  if (native.type === "mcpToolCall" && native.result !== undefined) {
    output = native.result;
    serialized = true;
  }
  if (native.type === "dynamicToolCall") {
    output = native.contentItems;
    serialized = true;
  }
  if (native.type === "functionCallOutput") {
    output = native.output;
    serialized = typeof output !== "string";
  }
  let retained: ReturnType<ReturnType<typeof createToolOutputBuffer>["result"]> | undefined;
  if (output !== undefined) {
    const buffer = createToolOutputBuffer();
    if (serialized) buffer.appendJson(output);
    else buffer.append(String(output));
    retained = buffer.result();
  }
  return {
    id: native.id,
    type: types[native.type],
    text:
      native.type === "reasoning"
        ? native.summary?.join("\n")
        : (native.text ??
          native.content?.map((part) => (typeof part === "string" ? part : (part.text ?? ""))).join("")),
    command: native.command,
    aggregated_output: retained?.output,
    resultSummary: retained?.resultSummary,
    exit_code: native.exitCode,
    status:
      native.success === false
        ? "failed"
        : (native.status ?? (native.type === "functionCallOutput" ? "completed" : undefined)),
    changes: native.changes?.map((change) => ({ path: change.path, kind: change.kind.type })),
    server: native.server ?? native.namespace ?? undefined,
    tool: native.tool ?? native.name,
    input: native.arguments,
    query: native.query,
    path: native.path,
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
  const outputs = new Map<string, ReturnType<typeof createToolOutputBuffer>>();
  let usage: CodexUsage | undefined;
  const retainCommandOutput = (native: NativeItem, item: CodexThreadItem, completed: boolean) => {
    if (native.type !== "commandExecution") return;
    if (!completed) {
      const buffer = createToolOutputBuffer();
      buffer.append(native.aggregatedOutput ?? "");
      outputs.set(item.id, buffer);
      return;
    }
    const buffer = outputs.get(item.id);
    if (native.aggregatedOutput == null && buffer) {
      const result = buffer.result();
      item.aggregated_output = result.output;
      item.resultSummary = result.resultSummary;
    }
    outputs.delete(item.id);
  };
  const publishNativeItem = (native: NativeItem, completed: boolean) => {
    if (native.type === "imageView") native = { ...native, status: completed ? "completed" : "in_progress" };
    // The initial prompt already carries host attachments; only later native user messages are added.
    if (native.type === "userMessage" && initialUserMessageId && native.clientId === initialUserMessageId) return;
    const item = toThreadItem(native);
    if (!item) return;
    retainCommandOutput(native, item, completed);
    items.set(item.id, item);
    publish(item);
  };
  const publishDelta = (item: CodexThreadItem, field: "text" | "aggregated_output", delta: string) => {
    if (field === "text") {
      const updated = { ...item, text: (item.text ?? "") + delta };
      items.set(item.id, updated);
      publish(updated);
      return;
    }
    const buffer = outputs.get(item.id);
    if (!buffer) return;
    buffer.append(delta);
    const result = buffer.result();
    const updated = { ...item, aggregated_output: result.output, resultSummary: result.resultSummary };
    items.set(item.id, updated);
    publish(updated);
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
      publishNativeItem(params.item as NativeItem, message.method === "item/completed");
    }
    const deltaFields: Record<string, "text" | "aggregated_output"> = {
      "item/agentMessage/delta": "text",
      "item/reasoning/summaryTextDelta": "text",
      "item/commandExecution/outputDelta": "aggregated_output",
    };
    const field = deltaFields[message.method ?? ""];
    const item = items.get(String(params.itemId));
    if (field && item && typeof params.delta === "string") {
      publishDelta(item, field, params.delta);
    }
  };
  return { receive, getUsage: () => usage };
};
