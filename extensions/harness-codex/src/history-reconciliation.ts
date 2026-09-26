import { resolve } from "node:path";
import type { HarnessRecoveryInput, SessionMessage, ToolPart } from "@pstdio/sdk/extensions";
import {
  HistoryConflict,
  historyMessageKey,
  historyValueKey,
  mergeHistoryMetadata,
  reconcileMessageHistory,
} from "@pstdio/sdk/extensions";

// Decode only a literal shell -c argument. This never invokes a shell or evaluates
// substitutions; unsupported wrappers stay distinct and take the conflict path.
export const literalCommand = (command: string) => {
  const match = /^(?:\/[^\s]+\/)?(?:ba|z|da)?sh\s+-l?c\s+([\s\S]+)$/.exec(command);
  if (!match) return command;
  const argument = match[1];
  if (argument.startsWith("'") && argument.endsWith("'") && !argument.slice(1, -1).includes("'"))
    return argument.slice(1, -1);
  if (!argument.startsWith('"') || !argument.endsWith('"')) return command;
  const body = argument.slice(1, -1);
  let decoded = "";
  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    if (char === "\\" && /[$`"\\\n]/.test(body[i + 1] ?? "")) {
      const next = body[++i];
      if (next !== "\n") decoded += next;
    } else if (char === "$" || char === "`" || char === '"') return command;
    else decoded += char;
  }
  return decoded;
};

const execution = new Set(["shell", "command_execution", "exec_command"]);
const toolName = (name: string) => name.replace(/^mcp__/, "").replace(/__/g, ".");
const output = (value: unknown) =>
  typeof value === "string"
    ? value.replace(
        /^Chunk ID: [^\n]+\nWall time: [\d.]+ seconds\nProcess exited with code -?\d+\n(?:Original token count: \d+\n)?Output:\n/,
        "",
      )
    : value;

const projection = (part: ToolPart, cwd?: string) => {
  const input = part.state?.input;
  if (!execution.has(part.tool)) return [toolName(part.tool), input];
  if (!input || typeof input !== "object") return ["execution", input];
  const values = input as Record<string, unknown>;
  const command = values.cmd ?? values.command;
  const directory = values.workdir ?? values.cwd ?? cwd;
  return [
    "execution",
    typeof command === "string" ? literalCommand(command) : command,
    typeof directory === "string" ? resolve(cwd ?? ".", directory) : undefined,
  ];
};

const tool = (message: SessionMessage) =>
  message.parts.length === 1 && message.parts[0].type === "tool" ? message.parts[0] : undefined;

export const recoverCodexMessages = (input: HarnessRecoveryInput) =>
  reconcileMessageHistory(input, {
    key: (message) => {
      const part = tool(message);
      return part ? historyValueKey(projection(part, input.cwd)) : historyMessageKey(message);
    },
    merge: (known, native) => {
      const a = tool(known);
      const b = tool(native);
      if (!a || !b) return mergeHistoryMetadata(known, native);
      const aOutput = output(a.state?.output);
      const bOutput = output(b.state?.output);
      if (aOutput !== undefined && bOutput !== undefined && historyValueKey(aOutput) !== historyValueKey(bOutput)) {
        throw new HistoryConflict("conflicting_tool_output");
      }
      if (bOutput === undefined && aOutput !== undefined) return mergeHistoryMetadata(native, known);
      return mergeHistoryMetadata(known, native);
    },
    isGenerated: (message) =>
      message.role === "system" &&
      /^(codex-usage-|codex-error-|codex-turn-failed-)/.test(message.id) &&
      message.parts.every((part) => part.type === "token_usage" || part.type === "error"),
  });
