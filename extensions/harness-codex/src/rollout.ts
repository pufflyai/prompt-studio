import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SessionMessage, ToolPart } from "@pstdio/sdk/extensions";
import { classifyCodexTool } from "./items";

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

export const normalizeRollout = (content: string): SessionMessage[] => {
  const messages: SessionMessage[] = [];
  const toolIndex = new Map<string, number>();
  let counter = 0;

  const nextId = (kind: string) => `rollout-${kind}-${counter++}`;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let payload: RolloutPayload | undefined;
    try {
      const parsed = JSON.parse(trimmed) as { type?: string; payload?: RolloutPayload };
      if (parsed.type !== "response_item") continue;
      payload = parsed.payload;
    } catch {
      continue;
    }

    if (!payload) continue;

    if (payload.type === "message") {
      if (payload.role !== "user" && payload.role !== "assistant") continue;

      const text = contentText(payload.content);
      if (!text || isInjectedContext(text)) continue;

      messages.push({ id: nextId("text"), role: payload.role, parts: [{ type: "text", text }] });
      continue;
    }

    if (payload.type === "reasoning") {
      const text = contentText(payload.summary);
      if (!text) continue;

      messages.push({ id: nextId("reasoning"), role: "assistant", parts: [{ type: "reasoning", text }] });
      continue;
    }

    if (payload.type === "function_call" && payload.call_id) {
      const tool = payload.name ?? "unknown";
      const part: ToolPart = {
        type: "tool",
        tool,
        callId: payload.call_id,
        actionType: classifyCodexTool(tool),
        status: "pending",
        state: { input: parseArguments(payload.arguments) },
      };

      toolIndex.set(payload.call_id, messages.length);
      messages.push({ id: nextId("tool"), role: "assistant", parts: [part] });
      continue;
    }

    if (payload.type === "function_call_output" && payload.call_id) {
      const index = toolIndex.get(payload.call_id);
      if (index === undefined) continue;

      const existing = messages[index].parts[0] as ToolPart;
      messages[index] = {
        ...messages[index],
        parts: [{ ...existing, status: "completed", state: { ...existing.state, output: payload.output } }],
      };
    }
  }

  return messages;
};
