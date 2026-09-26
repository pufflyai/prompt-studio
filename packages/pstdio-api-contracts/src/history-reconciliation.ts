import { historyTurnEvidence } from "./history-turn-evidence";
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

const positions = <T>(items: T[], key: (item: T) => string) => {
  const result = new Map<string, number[]>();
  items.forEach((item, index) => {
    const value = key(item);
    const indices = result.get(value) ?? [];
    indices.push(index);
    result.set(value, indices);
  });
  return result;
};

// Unique ordered anchors establish where one-sided gaps belong. Repeated runs
// can pair only when the complete interval agrees, retaining every occurrence.
export const mergeOrderedHistory = <T>(
  known: T[],
  native: T[],
  key: (item: T) => string,
  merge: (known: T, native: T) => T,
  refineKey?: (known: T[], native: T[]) => (item: T) => string,
): T[] => {
  if (!known.length) return native;
  if (!native.length) return known;
  const knownPositions = positions(known, key);
  const nativePositions = positions(native, key);
  const anchors: [number, number][] = [];
  for (const [value, indices] of knownPositions) {
    const other = nativePositions.get(value);
    if (indices.length === 1 && other?.length === 1) anchors.push([indices[0], other[0]]);
  }
  if (!anchors.length) {
    if (refineKey) return mergeOrderedHistory(known, native, refineKey(known, native), merge);
    if (known.length === native.length && known.every((item, index) => key(item) === key(native[index]))) {
      return known.map((item, index) => merge(item, native[index]));
    }
    throw new HistoryConflict("ambiguous_interval");
  }
  let left = 0;
  let right = 0;
  const result: T[] = [];
  for (const [a, b] of anchors) {
    if (b < right) throw new HistoryConflict("conflicting_order");
    result.push(...mergeOrderedHistory(known.slice(left, a), native.slice(right, b), key, merge, refineKey));
    result.push(merge(known[a], native[b]));
    left = a + 1;
    right = b + 1;
  }
  result.push(...mergeOrderedHistory(known.slice(left), native.slice(right), key, merge, refineKey));
  return result;
};

export const splitHistoryTurns = (messages: readonly SessionMessage[]) => {
  const turns: SessionMessage[][] = [];
  for (const message of messages) {
    if (message.role === "user" || !turns.length) turns.push([]);
    turns[turns.length - 1].push(message);
  }
  return turns;
};

export const mergeHistoryMetadata = (known: SessionMessage, native: SessionMessage): SessionMessage => {
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

export const reconcileMessageHistory = (
  input: HistoryRecoveryInput,
  projection: HistoryProjection = {},
): HistoryRecoveryResult => {
  const key = projection.key ?? historyMessageKey;
  const merge = projection.merge ?? mergeHistoryMetadata;
  const generated = projection.isGenerated ?? isUsage;
  const mergeTurn = (known: SessionMessage[], native: SessionMessage[]) => {
    const startsWithUser = known[0]?.role === "user" && native[0]?.role === "user";
    const body = (turn: SessionMessage[]) =>
      combineTextRuns(turn.slice(startsWithUser ? 1 : 0).filter((message) => !generated(message)));
    const messages = mergeOrderedHistory(body(known), body(native), key, merge);
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
    const turns = mergeOrderedHistory(
      splitHistoryTurns(input.knownMessages),
      splitHistoryTurns(input.nativeMessages),
      prompt,
      mergeTurn,
      (known, native) =>
        historyTurnEvidence(known, native, prompt, (turn) =>
          combineTextRuns(turn.slice(1).filter((message) => !generated(message))).map(key),
        ),
    );
    const messages = turns
      .flat()
      .map((message, index) => (message.index === undefined ? message : { ...message, index }));
    return { kind: "recovered", messages };
  } catch (error) {
    if (error instanceof HistoryConflict) return { kind: "conflict", category: error.message };
    throw error;
  }
};
