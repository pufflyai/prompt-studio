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
 * Extends a match over every secret that overlaps it, so `abc` and `bcdefg` in `abcdefg` hide the
 * whole run rather than leave `defg`. Returns undefined when an overlapping secret may continue
 * past the bytes seen so far, unless the stream has ended.
 */
const coveredEnd = (bytes: Uint8Array, secrets: Uint8Array[], start: number, end: number, final: boolean) => {
  let covered = end;
  for (let changed = true; changed; ) {
    changed = false;
    for (const secret of secrets) {
      // Only starts inside the run can overlap it, so the search stays within the run.
      for (let at = start; at < covered && at + secret.length <= bytes.length; at++)
        if (at + secret.length > covered && startsWith(secret, bytes, at)) {
          covered = at + secret.length;
          changed = true;
        }
    }
  }
  if (final) return covered;
  for (let at = start; at < covered; at++)
    if (secrets.some((secret) => secret.length > bytes.length - at && startsWith(secret, bytes, at))) return undefined;
  return covered;
};

/**
 * Replaces secrets that start before `limit` and returns the redacted bytes with the raw rest.
 * Each secret's next position is searched once and moved forward only when passed, so many
 * matches of one value do not rescan the buffer for the others.
 */
const redactUpTo = (bytes: Uint8Array, secrets: Uint8Array[], limit: number, final = false) => {
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
    const end = coveredEnd(bytes, secrets, match.start, match.start + match.length, final);
    parts.push(bytes.subarray(position, match.start));
    position = match.start;
    // An overlapping secret may still be arriving: hold the whole run for the next chunk.
    if (end === undefined) break;
    parts.push(REDACTED);
    position = end;
  }
  return { emitted: Buffer.concat(parts), rest: bytes.subarray(position) };
};

/** Hides granted values in collected output, overlapping ones included. */
export const redactText = (text: string, values: string[]) => {
  const secrets = values.filter(Boolean).map((value) => new TextEncoder().encode(value));
  if (secrets.length === 0) return text;
  const bytes = new TextEncoder().encode(text);
  return new TextDecoder().decode(redactUpTo(bytes, secrets, bytes.length, true).emitted);
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
          const { emitted } = redactUpTo(held[type], secrets, held[type].length, true);
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
