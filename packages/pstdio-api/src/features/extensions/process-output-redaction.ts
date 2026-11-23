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

// Replaces every secret, leftmost first and longest on ties.
const replaceSecrets = (bytes: Uint8Array, secrets: Uint8Array[]) => {
  const parts: Uint8Array[] = [];
  let position = 0;
  while (true) {
    let match: { start: number; length: number } | undefined;
    for (const secret of secrets) {
      const start = indexOf(bytes, secret, position);
      if (start >= 0 && (!match || start < match.start || (start === match.start && secret.length > match.length)))
        match = { start, length: secret.length };
    }
    if (!match) break;
    parts.push(bytes.subarray(position, match.start), REDACTED);
    position = match.start + match.length;
  }
  parts.push(bytes.subarray(position));
  return Buffer.concat(parts);
};

/**
 * Hides granted host values in a child's streamed output, as `run` does for collected output.
 * Each stream holds back fewer bytes than the longest value, so a value split across chunks is
 * still found; the held bytes are released before the final exit event.
 */
export const redactProcessOutput = (handle: ProcessHandle, values: string[]): ProcessHandle => {
  const secrets = values.filter(Boolean).map((value) => new TextEncoder().encode(value));
  if (secrets.length === 0) return handle;
  const keep = Math.max(...secrets.map((secret) => secret.length)) - 1;

  const redacted = async function* (source: AsyncIterable<ProcessEvent>): AsyncGenerator<ProcessEvent> {
    const held = { stdout: new Uint8Array(), stderr: new Uint8Array() };
    for await (const event of source) {
      if (event.type === "exit") {
        for (const type of ["stdout", "stderr"] as const)
          if (held[type].length) yield { type, data: replaceSecrets(held[type], secrets) };
        yield event;
        return;
      }
      const bytes = replaceSecrets(Buffer.concat([held[event.type], event.data]), secrets);
      // A held tail never contains a whole secret, so replacing it again later is safe.
      const split = Math.max(0, bytes.length - keep);
      held[event.type] = bytes.subarray(split);
      if (split > 0) yield { type: event.type, data: bytes.subarray(0, split) };
    }
  };

  return { ...handle, events: () => ({ [Symbol.asyncIterator]: () => redacted(handle.events()) }) };
};
