import type { ProcessEvent, ProcessHandle } from "pstdio-api-contracts/extension-kernel";

const REDACTED = new TextEncoder().encode("[Redacted]");

const indexOf = (haystack: Uint8Array, needle: Uint8Array, from: number) => {
  outer: for (let start = from; start <= haystack.length - needle.length; start++) {
    for (let offset = 0; offset < needle.length; offset++)
      if (haystack[start + offset] !== needle[offset]) continue outer;
    return start;
  }
  return -1;
};

// Whether the bytes at `from` match the secret, as far as both go.
const startsWith = (secret: Uint8Array, bytes: Uint8Array, from: number) => {
  for (let offset = 0; offset < secret.length && from + offset < bytes.length; offset++)
    if (secret[offset] !== bytes[from + offset]) return false;
  return true;
};

/**
 * Extends a run over every secret that overlaps it, so `abc` and `bcdefg` in `abcdefg` hide the
 * whole run rather than leave `defg`. The covered end only grows, so one forward sweep checks
 * each position once.
 */
const coveredEnd = (bytes: Uint8Array, secrets: Uint8Array[], start: number, end: number) => {
  let covered = end;
  for (let at = start; at < covered; at++)
    for (const secret of secrets)
      if (at + secret.length > covered && at + secret.length <= bytes.length && startsWith(secret, bytes, at))
        covered = at + secret.length;
  return covered;
};

// The first position in the run whose rest may still grow into a longer secret, if any.
const unfinishedIn = (bytes: Uint8Array, secrets: Uint8Array[], start: number, covered: number, keep: number) => {
  for (let at = Math.max(start, bytes.length - keep); at < covered; at++)
    if (secrets.some((secret) => secret.length > bytes.length - at && startsWith(secret, bytes, at))) return at;
  return undefined;
};

type Match = { start: number; length: number };

/**
 * The leftmost secret at or after `position`, the longest one when several start there. Each
 * secret's next position is searched once and moved forward only when passed, so many matches of
 * one value do not rescan the buffer for the others.
 */
const leftmostMatch = (bytes: Uint8Array, secrets: Uint8Array[], next: number[], position: number, carried?: Match) => {
  let match = carried;
  for (const [index, secret] of secrets.entries()) {
    if (next[index]! >= 0 && next[index]! < position) next[index] = indexOf(bytes, secret, position);
    const start = next[index]!;
    if (start >= 0 && (!match || start < match.start || (start === match.start && secret.length > match.length)))
      match = { start, length: secret.length };
  }
  return match;
};

/**
 * Replaces secrets that start before `limit` and returns the redacted bytes with the raw rest.
 * `forced` bytes at the start belong to a run already being hidden. A run that may still grow
 * past the bytes seen so far is hidden up to its unfinished part, and only that part, shorter
 * than the longest secret, is held with the count of its bytes that must still be hidden.
 */
const redactUpTo = (
  bytes: Uint8Array,
  secrets: Uint8Array[],
  limit: number,
  final = false,
  forced = 0,
  marked = false,
) => {
  const next = secrets.map((secret) => indexOf(bytes, secret, 0));
  const keep = Math.max(...secrets.map((secret) => secret.length));
  const parts: Uint8Array[] = [];
  const carried = forced > 0 ? { start: 0, length: Math.min(forced, bytes.length) } : undefined;
  let position = 0;
  while (position < limit) {
    const match = leftmostMatch(bytes, secrets, next, position, position === 0 ? carried : undefined);
    if (!match || match.start >= limit) {
      parts.push(bytes.subarray(position, limit));
      position = limit;
      break;
    }
    const covered = coveredEnd(bytes, secrets, match.start, match.start + match.length);
    parts.push(bytes.subarray(position, match.start));
    // A run carried over from the last chunk already has its marker when that chunk emitted one.
    const continues = match.start === 0 && carried !== undefined && marked;
    const unfinished = final ? undefined : unfinishedIn(bytes, secrets, match.start, covered, keep);
    if (!continues && (unfinished === undefined || unfinished > match.start)) parts.push(REDACTED);
    if (unfinished === undefined) {
      position = covered;
      continue;
    }
    const held = { forced: covered - unfinished, marked: continues || unfinished > match.start };
    return { emitted: Buffer.concat(parts), rest: bytes.subarray(unfinished), ...held };
  }
  // Nothing processed: the bytes still owed to a run stay owed.
  const owed = position === 0 ? { forced, marked } : { forced: 0, marked: false };
  return { emitted: Buffer.concat(parts), rest: bytes.subarray(position), ...owed };
};

/**
 * Where the bytes that may still become a secret begin: the first position whose rest is the
 * start of a longer secret. Everything before it is complete, so a prompt such as `ready` is not
 * held back waiting for bytes that cannot complete a secret.
 */
const pendingFrom = (bytes: Uint8Array, secrets: Uint8Array[], keep: number) => {
  for (let position = Math.max(0, bytes.length - keep); position < bytes.length; position++)
    if (secrets.some((secret) => secret.length > bytes.length - position && startsWith(secret, bytes, position)))
      return position;
  return bytes.length;
};

/**
 * Hides granted host values in a child's streamed output, as `run` does for collected output.
 * Each stream holds back only bytes that could still become a value, so a value split across
 * chunks is still found; the held bytes are released before the final exit event.
 */
export const redactProcessOutput = (handle: ProcessHandle, values: string[]) => {
  const secrets = values.filter(Boolean).map((value) => new TextEncoder().encode(value));
  if (secrets.length === 0) return handle;
  const keep = Math.max(...secrets.map((secret) => secret.length)) - 1;

  const redacted = async function* (source: AsyncIterable<ProcessEvent>) {
    const held: Record<"stdout" | "stderr", Uint8Array> = { stdout: new Uint8Array(), stderr: new Uint8Array() };
    // Held bytes that belong to a run already being hidden, and whether its marker was sent.
    const owed: Record<"stdout" | "stderr", number> = { stdout: 0, stderr: 0 };
    const marked: Record<"stdout" | "stderr", boolean> = { stdout: false, stderr: false };
    for await (const event of source) {
      if (event.type === "exit") {
        for (const type of ["stdout", "stderr"] as const) {
          const { emitted } = redactUpTo(held[type], secrets, held[type].length, true, owed[type], marked[type]);
          if (emitted.length) yield { type, data: emitted } satisfies ProcessEvent;
        }
        yield event;
        return;
      }
      const bytes = Buffer.concat([held[event.type], event.data]);
      const limit = Math.max(pendingFrom(bytes, secrets, keep), Math.min(owed[event.type], bytes.length));
      const result = redactUpTo(bytes, secrets, limit, false, owed[event.type], marked[event.type]);
      const { emitted, rest } = result;
      held[event.type] = rest;
      owed[event.type] = result.forced;
      marked[event.type] = result.marked;
      if (emitted.length) yield { type: event.type, data: emitted } satisfies ProcessEvent;
    }
  };

  const events = () => {
    const source = handle.events()[Symbol.asyncIterator]();
    const output = redacted({ [Symbol.asyncIterator]: () => source });
    const iterator: AsyncIterableIterator<ProcessEvent> = {
      [Symbol.asyncIterator]: () => iterator,
      next: () => output.next(),
      async return() {
        // Close the raw reader first. A generator's return queues behind its pending read.
        await source.return?.();
        return output.return(undefined);
      },
    };
    return iterator;
  };
  return { ...handle, events };
};
