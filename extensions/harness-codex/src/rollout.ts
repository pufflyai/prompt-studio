import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SessionMessage, ToolPart } from "@pstdio/sdk/extensions";
import { classifyCodexTool } from "./items";
import { parseTimestamp } from "./utils";

type RolloutMessageContent = { type: string; text?: string };

type RolloutPayload = {
  type?: string;
  role?: string;
  content?: RolloutMessageContent[];
  summary?: RolloutMessageContent[];
  name?: string;
  arguments?: string;
  call_id?: string;
  output?: string;
};

interface RolloutState {
  messages: SessionMessage[];
  toolIndex: Map<string, number>;
  nextId: (kind: string) => string;
}

export const codexSessionsRoot = () =>
  join(process.env.CODEX_HOME ?? join(process.env.HOME ?? "", ".codex"), "sessions");

// Rollout files live under <sessions>/<year>/<month>/<day>/rollout-<timestamp>-<thread-id>.jsonl;
// the timestamp is unknown at lookup time, so match on the thread-id suffix.
export const findRolloutPath = (agentSessionId: string, root = codexSessionsRoot()) => {
  let entries: string[];

  try {
    entries = readdirSync(root, { recursive: true }) as string[];
  } catch {
    return null;
  }

  const match = entries.find((entry) => entry.endsWith(`-${agentSessionId}.jsonl`));
  return match ? join(root, match) : null;
};

export const readRollout = async (agentSessionId: string) => {
  const path = findRolloutPath(agentSessionId);
  if (!path) return "";

  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
};

const contentText = (content: RolloutMessageContent[] | undefined) =>
  (content ?? [])
    .map((part) => part.text ?? "")
    .filter((text) => text.length > 0)
    .join("\n");

// Codex injects context blocks as regular user/developer messages; only genuine
// conversation turns should surface in the session history.
const isInjectedContext = (text: string) =>
  text.startsWith("<environment_context>") ||
  text.startsWith("<permissions instructions>") ||
  text.startsWith("<user_instructions>") ||
  text.startsWith("<turn_context>");

const parseArguments = (raw: string | undefined) => {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
};

const parseRolloutLine = (line: string) => {
  try {
    const parsed = JSON.parse(line) as { type?: string; timestamp?: string; payload?: RolloutPayload };
    if (parsed.type !== "response_item" || !parsed.payload) return undefined;

    return { createdAt: parseTimestamp(parsed.timestamp), payload: parsed.payload };
  } catch {
    return undefined;
  }
};

const appendMessage = (payload: RolloutPayload, createdAt: number | undefined, state: RolloutState) => {
  if (payload.role !== "user" && payload.role !== "assistant") return;

  const text = contentText(payload.content);
  if (!text || isInjectedContext(text)) return;

  state.messages.push({ id: state.nextId("text"), role: payload.role, parts: [{ type: "text", text }], createdAt });
};

const appendReasoning = (payload: RolloutPayload, createdAt: number | undefined, state: RolloutState) => {
  const text = contentText(payload.summary);
  if (!text) return;

  state.messages.push({
    id: state.nextId("reasoning"),
    role: "assistant",
    parts: [{ type: "reasoning", text }],
    createdAt,
  });
};

const appendFunctionCall = (payload: RolloutPayload, createdAt: number | undefined, state: RolloutState) => {
  if (!payload.call_id) return;

  const tool = payload.name ?? "unknown";
  const part: ToolPart = {
    type: "tool",
    tool,
    callId: payload.call_id,
    actionType: classifyCodexTool(tool),
    status: "pending",
    state: { input: parseArguments(payload.arguments) },
  };

  state.toolIndex.set(payload.call_id, state.messages.length);
  state.messages.push({ id: state.nextId("tool"), role: "assistant", parts: [part], createdAt });
};

const completeFunctionCall = (payload: RolloutPayload, state: RolloutState) => {
  if (!payload.call_id) return;

  const index = state.toolIndex.get(payload.call_id);
  if (index === undefined) return;

  const existingMessage = state.messages[index];
  const existingPart = existingMessage.parts[0] as ToolPart;
  state.messages[index] = {
    ...existingMessage,
    parts: [{ ...existingPart, status: "completed", state: { ...existingPart.state, output: payload.output } }],
  };
};

const appendPayload = (payload: RolloutPayload, createdAt: number | undefined, state: RolloutState) => {
  switch (payload.type) {
    case "message":
      appendMessage(payload, createdAt, state);
      break;
    case "reasoning":
      appendReasoning(payload, createdAt, state);
      break;
    case "function_call":
      appendFunctionCall(payload, createdAt, state);
      break;
    case "function_call_output":
      completeFunctionCall(payload, state);
      break;
  }
};

export const normalizeRollout = (content: string): SessionMessage[] => {
  let counter = 0;
  const state: RolloutState = {
    messages: [],
    toolIndex: new Map(),
    nextId: (kind) => `rollout-${kind}-${counter++}`,
  };

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const item = parseRolloutLine(trimmed);
    if (item) appendPayload(item.payload, item.createdAt, state);
  }

  return state.messages;
};
