import { type SessionMessage, sessionMessageSchema } from "pstdio-api-contracts";

// The position preserves conversation order; the message ID identifies later corrections.
export type LogEntry = { i: number; m: string };
const batchBytes = 700_000;

export const messageEntries = (index: number, message: SessionMessage) => [
  JSON.stringify({ i: index, m: JSON.stringify(message) }),
];

/** Groups complete messages into updates. Oversized batches travel through encrypted blobs. */
export function* batchLines(lines: Iterable<string>) {
  let current: string[] = [];
  let size = 0;
  for (const line of lines) {
    const bytes = Buffer.byteLength(line) + 1;
    if (current.length && size + bytes > batchBytes) {
      yield current;
      current = [];
      size = 0;
    }
    current.push(line);
    size += bytes;
  }
  if (current.length) yield current;
}

export const createLineReader = () => (line: string) => {
  if (!line) return;
  const entry = JSON.parse(line) as LogEntry;
  if (!Number.isSafeInteger(entry.i) || entry.i < 0) throw new Error("Invalid session message position");
  return { index: entry.i, message: sessionMessageSchema.parse(JSON.parse(entry.m)) };
};

/** Replaying a page after an interrupted write does not duplicate messages. */
export const readLines = (lines: Iterable<string>) => {
  const messages = new Map<string, { index: number; message: SessionMessage }>();
  const read = createLineReader();
  for (const line of lines) {
    const entry = read(line);
    if (entry) messages.set(entry.message.id, entry);
  }
  return [...messages.values()].sort((a, b) => a.index - b.index).map(({ message }) => message);
};
