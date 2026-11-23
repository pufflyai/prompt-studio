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

// The leftmost secret at or after `from`, the longest one when several start there.
const nextMatch = (bytes: Uint8Array, secrets: Uint8Array[], from: number) => {
  let match: { start: number; length: number } | undefined;
  for (const secret of secrets) {
    const start = indexOf(bytes, secret, from);
    if (start >= 0 && (!match || start < match.start || (start === match.start && secret.length > match.length)))
      match = { start, length: secret.length };
  }
  return match;
};

/**
 * Replaces secrets that start before `limit` and returns the redacted bytes with the raw rest.
 * A match starting before `limit` is complete, longest alternative included, because the rest is
 * at least as long as the longest secret minus one. Matches starting later wait for more bytes.
 */
const redactUpTo = (bytes: Uint8Array, secrets: Uint8Array[], limit: number) => {
  const parts: Uint8Array[] = [];
  let position = 0;
  while (position < limit) {
    const match = nextMatch(bytes, secrets, position);
    if (!match || match.start >= limit) {
      parts.push(bytes.subarray(position, limit));
      position = limit;
      break;
    }
    parts.push(bytes.subarray(position, match.start), REDACTED);
    position = match.start + match.length;
  }
  return { emitted: Buffer.concat(parts), rest: bytes.subarray(position) };
};

/**
 * Hides granted host values in a child's streamed output, as `run` does for collected output.
 * Each stream holds back fewer raw bytes than the longest value, so a value split across chunks
 * is still found; the held bytes are released before the final exit event.
 */
export const redactProcessOutput = (handle: ProcessHandle, values: string[]) => {
  const secrets = values.filter(Boolean).map((value) => new TextEncoder().encode(value));
  if (secrets.length === 0) return handle;
  const keep = Math.max(...secrets.map((secret) => secret.length)) - 1;

  const redacted = async function* (source: AsyncIterable<ProcessEvent>) {
    const held: Record<"stdout" | "stderr", Uint8Array> = { stdout: new Uint8Array(), stderr: new Uint8Array() };
    for await (const event of source) {
      if (event.type === "exit") {
        for (const type of ["stdout", "stderr"] as const) {
          const { emitted } = redactUpTo(held[type], secrets, held[type].length);
          if (emitted.length) yield { type, data: emitted } satisfies ProcessEvent;
        }
        yield event;
        return;
      }
      const bytes = Buffer.concat([held[event.type], event.data]);
      const { emitted, rest } = redactUpTo(bytes, secrets, Math.max(0, bytes.length - keep));
      held[event.type] = rest;
      if (emitted.length) yield { type: event.type, data: emitted } satisfies ProcessEvent;
    }
  };

  return { ...handle, events: () => ({ [Symbol.asyncIterator]: () => redacted(handle.events()) }) };
};
