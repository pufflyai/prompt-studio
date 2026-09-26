import type { HarnessRecoveryInput, SessionMessage } from "@pstdio/sdk/extensions";
import {
  HistoryConflict,
  historyMessageKey,
  historyValueKey,
  mergeHistoryMetadata,
  reconcileMessageHistory,
} from "@pstdio/sdk/extensions";

const tool = (message: SessionMessage) =>
  message.parts.length === 1 && message.parts[0].type === "tool" ? message.parts[0] : undefined;
const display = (output: unknown) =>
  output && typeof output === "object" && "returnDisplay" in output ? output.returnDisplay : output;

export const recoverClaudeMessages = (input: HarnessRecoveryInput) =>
  reconcileMessageHistory(input, {
    key: (message) => {
      const part = tool(message);
      return part?.callId ? `tool:${part.callId}` : historyMessageKey(message);
    },
    merge: (known, native) => {
      const a = tool(known);
      const b = tool(native);
      if (!a || !b) return mergeHistoryMetadata(known, native);
      for (const field of ["input", "output"] as const) {
        const left = field === "output" ? display(a.state?.output) : a.state?.input;
        const right = field === "output" ? display(b.state?.output) : b.state?.input;
        if (left !== undefined && right !== undefined && historyValueKey(left) !== historyValueKey(right)) {
          throw new HistoryConflict(`conflicting_tool_${field}`);
        }
      }
      return b.state?.output === undefined && a.state?.output !== undefined
        ? mergeHistoryMetadata(native, known)
        : mergeHistoryMetadata(known, native);
    },
    isGenerated: (message) =>
      message.role === "system" &&
      /^stream-(result|error)-/.test(message.id) &&
      message.parts.every((part) => part.type === "token_usage" || part.type === "error"),
  });
