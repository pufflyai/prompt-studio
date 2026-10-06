import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { SessionMessage, ToolPart } from "@pstdio/sdk/extensions";
import { classifyCodexTool } from "./items";
import { type CodexQuestion, questionAnswerText, questionInput } from "./questions";
import { type RolloutItem, rolloutItemMessage } from "./rollout-items";
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
  item?: RolloutItem;
};

interface RolloutState {
  messages: SessionMessage[];
  toolIndex: Map<string, number>;
  nextId: (kind: string) => string;
}

export const codexSessionsRoot = () => join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "sessions");

// Rollout files live under <sessions>/<year>/<month>/<day>/rollout-<timestamp>-<thread-id>.jsonl;
// the timestamp is unknown at lookup time, so match on the thread-id suffix. Harness code runs in
// the API process, so the scan is async, and a thread keeps its file, so a found path is cached.
const rolloutPaths = new Map<string, string>();

export const findRolloutPath = async (agentSessionId: string, root = codexSessionsRoot()) => {
  const key = join(root, agentSessionId);
  const cached = rolloutPaths.get(key);
  if (cached) return cached;

  let entries: string[];
  try {
    entries = await readdir(root, { recursive: true });
  } catch {
    return null;
  }

  const match = entries.find((entry) => entry.endsWith(`-${agentSessionId}.jsonl`));
  if (!match) return null;
  const path = join(root, match);
  rolloutPaths.set(key, path);
  return path;
};

export const readRollout = async (agentSessionId: string) => {
  const path = await findRolloutPath(agentSessionId);
  if (!path) throw new Error("Native transcript unavailable");
  return readFile(path, "utf8");
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
    if (!parsed.payload) return undefined;

    return { type: parsed.type, createdAt: parseTimestamp(parsed.timestamp), payload: parsed.payload };
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

  const tool = payload.name === "request_user_input" ? "question" : (payload.name ?? "unknown");
  const input = parseArguments(payload.arguments);
  const part: ToolPart = {
    type: "tool",
    tool,
    callId: payload.call_id,
    actionType: classifyCodexTool(tool),
    status: "pending",
    state: { input: tool === "question" ? questionInput((input as { questions: CodexQuestion[] }).questions) : input },
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
  let output: unknown = payload.output;
  if (existingPart.tool === "question") {
    const result = parseArguments(payload.output) as { answers?: Record<string, { answers: string[] }> };
    const input = existingPart.state?.input as { questions: CodexQuestion[] };
    if (result?.answers) output = questionAnswerText(input.questions, result.answers);
  }
  state.messages[index] = {
    ...existingMessage,
    parts: [{ ...existingPart, status: "completed", state: { ...existingPart.state, output } }],
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

interface RolloutTurn {
  state: RolloutState;
  items: SessionMessage[] | null;
}

// Newer Codex versions also record each turn's completed items, which match the live
// stream exactly. Code mode wraps tool calls in scripts, so its response items cannot.
// A resumed thread can mix both versions, so each turn uses its own best record.
export const normalizeRollout = (content: string): SessionMessage[] => {
  let counter = 0;
  const nextId = (kind: string) => `rollout-${kind}-${counter++}`;
  const newTurn = (): RolloutTurn => ({ state: { messages: [], toolIndex: new Map(), nextId }, items: null });
  const turns = [newTurn()];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const item = parseRolloutLine(trimmed);
    if (!item) continue;
    const turn = turns[turns.length - 1];
    if (item.type === "response_item") appendPayload(item.payload, item.createdAt, turn.state);
    if (item.type !== "event_msg") continue;
    if (item.payload.type === "task_started") turns.push(newTurn());
    if (item.payload.type === "item_completed" && item.payload.item) {
      turn.items ??= [];
      const message = rolloutItemMessage(item.payload.item, item.createdAt);
      if (message) turn.items.push(message);
    }
  }

  return turns.flatMap((turn) => {
    if (!turn.items) return turn.state.messages;
    // Questions are server requests and have no completed ThreadItem record.
    const questions = turn.state.messages.filter((message) =>
      message.parts.some((part) => part.type === "tool" && part.tool === "question"),
    );
    return [...questions, ...turn.items].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  });
};
