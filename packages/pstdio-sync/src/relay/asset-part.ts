import { createHash } from "node:crypto";
import { mkdtemp, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ReadableStreamDefaultReader } from "node:stream/web";

export const stageRelayPart = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  pending: Uint8Array,
  byteLength: number,
  path: string,
  signal: AbortSignal,
) => {
  const file = await open(path, "w");
  const hash = createHash("sha256");
  let written = 0;
  try {
    while (written < byteLength) {
      signal.throwIfAborted();
      if (!pending.length) {
        const next = await reader.read();
        signal.throwIfAborted();
        if (next.done) throw new Error("Incomplete local asset");
        pending = next.value;
      }
      const bytes = pending.subarray(0, byteLength - written);
      await file.writeFile(bytes);
      hash.update(bytes);
      written += bytes.length;
      pending = pending.subarray(bytes.length);
    }
    return { pending, sha256: hash.digest("hex") };
  } finally {
    await file.close();
  }
};

export const withRelaySpool = async <T>(action: (directory: string) => Promise<T>) => {
  const directory = await mkdtemp(join(tmpdir(), "pstdio-relay-upload-"));
  try {
    return await action(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};
