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

const startsWith = (secret: Uint8Array, bytes: Uint8Array, from: number) => {
  for (let offset = 0; from + offset < bytes.length; offset++)
    if (secret[offset] !== bytes[from + offset]) return false;
  return true;
};

/**
 * Replaces secrets that start before `limit` and returns the redacted bytes with the raw rest.
 * Each secret's next position is searched once and moved forward only when passed, so many
 * matches of one value do not rescan the buffer for the others.
 */
const redactUpTo = (bytes: Uint8Array, secrets: Uint8Array[], limit: number) => {
  const next = secrets.map((secret) => indexOf(bytes, secret, 0));
  const parts: Uint8Array[] = [];
  let position = 0;
  while (position < limit) {
    // The leftmost secret at or after `position`, the longest one when several start there.
    let match: { start: number; length: number } | undefined;
    for (const [index, secret] of secrets.entries()) {
      if (next[index]! >= 0 && next[index]! < position) next[index] = indexOf(bytes, secret, position);
      const start = next[index]!;
      if (start >= 0 && (!match || start < match.start || (start === match.start && secret.length > match.length)))
        match = { start, length: secret.length };
    }
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
      const { emitted, rest } = redactUpTo(bytes, secrets, pendingFrom(bytes, secrets, keep));
      held[event.type] = rest;
      if (emitted.length) yield { type: event.type, data: emitted } satisfies ProcessEvent;
    }
  };

  return { ...handle, events: () => ({ [Symbol.asyncIterator]: () => redacted(handle.events()) }) };
};
