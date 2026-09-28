import { historyTurnEvidence } from "./history-turn-evidence";
import { mergeOrderedHistory } from "./ordered-history-merge";
import type { SessionMessage } from "./session-messages";

export type HistoryRecoveryResult =
  | { kind: "recovered"; messages: SessionMessage[] }
  | { kind: "conflict"; category: string };

export interface HistoryRecoveryInput {
  knownMessages: readonly SessionMessage[];
  nativeMessages: readonly SessionMessage[];
}

export interface HistoryProjection {
  key?: (message: SessionMessage) => string;
  merge?: (known: SessionMessage, native: SessionMessage) => SessionMessage;
  isGenerated?: (message: SessionMessage) => boolean;
}

export class HistoryConflict extends Error {}

export { mergeOrderedHistory };

export const submittedPrompt = (message: SessionMessage) =>
  message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .replace(/\n\n<session-attachments>[\s\S]*<\/session-attachments>\s*$/, "")
    .trim();

export const historyValueKey = (value: unknown) =>
  JSON.stringify(value, (_key, item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)));
  });

export const historyMessageKey = (message: SessionMessage) => historyValueKey([message.role, message.parts]);

export const splitHistoryTurns = (messages: readonly SessionMessage[]) => {
  const turns: SessionMessage[][] = [];
  for (const message of messages) {
    if (message.role === "user" || !turns.length) turns.push([]);
    turns[turns.length - 1].push(message);
  }
  return turns;
};

export const mergeHistoryMetadata = (known: SessionMessage, native: SessionMessage) => {
  const files = native.parts.filter((part) => part.type === "file");
  const fileKeys = new Set(files.map((part) => part.fileId ?? part.url));
  const missing = known.parts.filter((part) => part.type === "file" && !fileKeys.has(part.fileId ?? part.url));
  const parts =
    native.role === "user"
      ? [...known.parts.filter((part) => part.type === "text"), ...native.parts.filter((part) => part.type !== "text")]
      : native.parts;
  return { ...known, ...native, parts: [...parts, ...missing] };
};

const isUsage = (message: SessionMessage) =>
  message.role === "system" && message.parts.length > 0 && message.parts.every((part) => part.type === "token_usage");

const combineTextRuns = (messages: SessionMessage[]) => {
  const runs: SessionMessage[] = [];
  for (const message of messages) {
    const previous = runs.at(-1);
    const part = message.parts[0];
    const previousPart = previous?.parts[0];
    if (
      previous &&
      message.role === previous.role &&
      message.parts.length === 1 &&
      previous.parts.length === 1 &&
      (part.type === "text" || part.type === "reasoning") &&
      previousPart?.type === part.type
    ) {
      runs[runs.length - 1] = { ...previous, parts: [{ ...part, text: previousPart.text + part.text }] };
    } else runs.push(message);
  }
  return runs;
};

export const reconcileMessageHistory = (input: HistoryRecoveryInput, projection: HistoryProjection = {}) => {
  const key = projection.key ?? historyMessageKey;
  const merge = projection.merge ?? mergeHistoryMetadata;
  const generated = projection.isGenerated ?? isUsage;
  const mergeTurn = (known: SessionMessage[], native: SessionMessage[]) => {
    const startsWithUser = known[0]?.role === "user" && native[0]?.role === "user";
    const body = (turn: SessionMessage[]) =>
      combineTextRuns(turn.slice(startsWithUser ? 1 : 0).filter((message) => !generated(message)));
    const shown = known.flatMap((message) =>
      message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])),
    );
    const saved = shown.join("");
    const messages = mergeOrderedHistory(body(known), body(native), {
      key,
      merge,
      time: (message) => message.createdAt,
      // Sources can split one reply into different chunks; text the user already saw is not missing.
      covered: (message) =>
        message.parts.length > 0 && message.parts.every((part) => part.type === "text" && saved.includes(part.text)),
    });
    const metadata = [...native.filter(generated)];
    const counts = new Map<string, number>();
    metadata.forEach((message) => {
      counts.set(historyMessageKey(message), (counts.get(historyMessageKey(message)) ?? 0) + 1);
    });
    for (const message of known.filter(generated)) {
      const value = historyMessageKey(message);
      const remaining = counts.get(value) ?? 0;
      if (remaining) counts.set(value, remaining - 1);
      else metadata.push(message);
    }
    return [...(startsWithUser ? [mergeHistoryMetadata(known[0], native[0])] : []), ...messages, ...metadata];
  };
  try {
    const prompt = (turn: SessionMessage[]) =>
      turn[0]?.role === "user" ? `user:${submittedPrompt(turn[0])}` : "prefix";
    const turns = mergeOrderedHistory(splitHistoryTurns(input.knownMessages), splitHistoryTurns(input.nativeMessages), {
      key: prompt,
      merge: mergeTurn,
      refineKey: (known, native) =>
        historyTurnEvidence(known, native, prompt, (turn) =>
          combineTextRuns(turn.slice(1).filter((message) => !generated(message))).map(key),
        ),
      time: (turn) => turn[0]?.createdAt,
    });
    const messages = turns
      .flat()
      .map((message, index) => (message.index === undefined ? message : { ...message, index }));
    return { kind: "recovered", messages } satisfies HistoryRecoveryResult;
  } catch (error) {
    if (error instanceof HistoryConflict)
      return { kind: "conflict", category: error.message } satisfies HistoryRecoveryResult;
    throw error;
  }
};
