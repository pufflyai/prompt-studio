import type { HarnessRecoveryInput, SessionMessage } from "@pstdio/sdk/extensions";
import {
  HistoryConflict,
  type HistoryProjection,
  historyMessageKey,
  historyValueKey,
  mergeHistoryMetadata,
  reconcileMessageHistory,
} from "@pstdio/sdk/extensions";

const tool = (message: SessionMessage) =>
  message.parts.length === 1 && message.parts[0].type === "tool" ? message.parts[0] : undefined;
const display = (output: unknown) =>
  output && typeof output === "object" && "returnDisplay" in output ? output.returnDisplay : output;

const projection: HistoryProjection = {
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
};

export const recoverClaudeMessages = (input: HarnessRecoveryInput) => {
  const nativeUsers = new Map(
    input.nativeMessages.flatMap((message, index) => (message.role === "user" ? [[message.id, index] as const] : [])),
  );
  const messages: SessionMessage[] = [];
  let knownOffset = 0;
  let nativeOffset = 0;
  const recoverSpan = (knownEnd: number, nativeEnd: number) => {
    const result = reconcileMessageHistory(
      {
        knownMessages: input.knownMessages.slice(knownOffset, knownEnd),
        nativeMessages: input.nativeMessages.slice(nativeOffset, nativeEnd),
      },
      projection,
    );
    if (result.kind === "conflict") throw new HistoryConflict(result.category);
    messages.push(...result.messages);
  };
  try {
    // Native user UUIDs anchor submissions even when identical prompts have unfinished replies.
    // Between anchors the shared recovery API still owns content, tool and legacy-history merging.
    for (const [knownIndex, message] of input.knownMessages.entries()) {
      if (message.role !== "user") continue;
      const nativeIndex = nativeUsers.get(message.id);
      if (nativeIndex === undefined) continue;
      if (nativeIndex < nativeOffset) throw new HistoryConflict("conflicting_user_order");
      recoverSpan(knownIndex, nativeIndex);
      messages.push(mergeHistoryMetadata(message, input.nativeMessages[nativeIndex]));
      knownOffset = knownIndex + 1;
      nativeOffset = nativeIndex + 1;
    }
    recoverSpan(input.knownMessages.length, input.nativeMessages.length);
    return {
      kind: "recovered" as const,
      messages: messages.map((message, index) => (message.index === undefined ? message : { ...message, index })),
    };
  } catch (error) {
    if (error instanceof HistoryConflict) return { kind: "conflict" as const, category: error.message };
    throw error;
  }
};
