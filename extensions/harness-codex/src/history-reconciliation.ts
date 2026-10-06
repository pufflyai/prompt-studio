import { resolve } from "node:path";
import type { HarnessRecoveryInput, SessionMessage, ToolPart } from "@pstdio/sdk/extensions";
import {
  historyMessageKey,
  historyValueKey,
  mergeHistoryMetadata,
  reconcileMessageHistory,
} from "@pstdio/sdk/extensions";

const SHELL_WORD = /(?:'[^']*'|"(?:\\[\s\S]|[^"\\])*"|\\[\s\S]|[^\s'"\\])+/g;
const QUOTED = /'([^']*)'|"((?:\\[\s\S]|[^"\\])*)"|\\([\s\S])/g;

// Inside double quotes a backslash escapes only these characters; a line continuation disappears.
const unescapeDouble = (text: string) =>
  text.replace(/\\([$`"\\\n])/g, (_, char: string) => (char === "\n" ? "" : char));

// Split a shell-quoted command into its arguments. This only removes POSIX quoting; it
// never invokes a shell or expands anything. Returns null for unbalanced quotes.
export const shellWords = (command: string) => {
  if (command.replace(SHELL_WORD, "").trim()) return null;
  return (command.match(SHELL_WORD) ?? []).map((word) =>
    word.replace(QUOTED, (_, single?: string, double?: string, escaped?: string) => {
      if (single !== undefined) return single;
      if (double !== undefined) return unescapeDouble(double);
      return escaped === "\n" ? "" : (escaped ?? "");
    }),
  );
};

// The live stream reports a command as one quoted string; the rollout keeps its arguments.
// Both reduce to the script a `sh -c` wrapper runs, or else to the argument list.
const commandScript = (command: unknown) => {
  const words = typeof command === "string" ? shellWords(command) : command;
  if (!Array.isArray(words)) return command;
  const [shell, flag, script, ...rest] = words;
  const wrapped = /^(?:\/\S+\/)?(?:ba|z|da)?sh$/.test(shell ?? "") && /^-l?c$/.test(flag ?? "");
  return wrapped && typeof script === "string" && rest.length === 0 ? script : words;
};

const execution = new Set(["shell", "command_execution", "exec_command"]);
const toolName = (name: string) => name.replace(/^mcp__/, "").replace(/__/g, ".");
const projection = (part: ToolPart, cwd?: string) => {
  const input = part.state?.input;
  if (part.tool === "question") return [part.tool, part.callId];
  if (!execution.has(part.tool)) return [toolName(part.tool), input];
  if (!input || typeof input !== "object") return ["execution", input];
  const values = input as Record<string, unknown>;
  // `cmd` is exec_command's script; `command` is a whole command line.
  const command = typeof values.cmd === "string" ? values.cmd : commandScript(values.command);
  const directory = values.workdir ?? values.cwd ?? cwd;
  return ["execution", command, typeof directory === "string" ? resolve(cwd ?? ".", directory) : undefined];
};

const tool = (message: SessionMessage) =>
  message.parts.length === 1 && message.parts[0].type === "tool" ? message.parts[0] : undefined;

export const recoverCodexMessages = (input: HarnessRecoveryInput) =>
  reconcileMessageHistory(input, {
    key: (message) => {
      const part = tool(message);
      return part ? historyValueKey(projection(part, input.cwd)) : historyMessageKey(message);
    },
    // The saved call is what the user saw. The rollout only completes a call whose
    // result the live stream never delivered.
    merge: (known, native) => {
      const a = tool(known);
      const b = tool(native);
      if (!a || !b) return mergeHistoryMetadata(known, native);
      if (a.state?.output !== undefined) return known;
      return { ...known, parts: [{ ...a, status: b.status, state: { ...a.state, output: b.state?.output } }] };
    },
    isGenerated: (message) =>
      message.role === "system" &&
      /^(codex-usage-|codex-error-|codex-turn-failed-)/.test(message.id) &&
      message.parts.every((part) => part.type === "token_usage" || part.type === "error"),
  });
