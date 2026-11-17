import { createHash } from "node:crypto";
import { closeSync, createReadStream, openSync, readFileSync, readSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";

export type RevisionHashInput = { value: string | Buffer } | { file: string };
const wholeFileLimit = 8 * 1024 * 1024;
const chunkSize = 1024 * 1024;

export const hashRevisionInputs = (inputs: RevisionHashInput[], contents: Map<string, Buffer>) => {
  const hash = createHash("sha256");
  let buffer: Buffer | undefined;
  for (const input of inputs) {
    if ("value" in input) {
      hash.update(input.value);
      continue;
    }
    const cached = contents.get(input.file);
    if (cached) hash.update(cached);
    else if (statSync(input.file).size <= wholeFileLimit) hash.update(readFileSync(input.file));
    else {
      buffer ??= Buffer.allocUnsafe(chunkSize);
      const descriptor = openSync(input.file, "r");
      try {
        while (true) {
          const length = readSync(descriptor, buffer, 0, buffer.byteLength, null);
          if (!length) break;
          hash.update(buffer.subarray(0, length));
        }
      } finally {
        closeSync(descriptor);
      }
    }
  }
  return hash.digest("hex");
};

const readHashFile = async (file: string, contents: Map<string, Buffer>) => {
  try {
    const cached = contents.get(file);
    if (cached) return { bytes: cached };
    // Large native assets stream only when consumed, so prefetch never allocates
    // several whole executables or opens streams that a failed read would abandon.
    if (statSync(file).size > wholeFileLimit) return { file };
    return { bytes: await readFile(file) };
  } catch (error) {
    return { error };
  }
};

export const hashRevisionInputsAsync = async (inputs: RevisionHashInput[], contents: Map<string, Buffer>) => {
  const hash = createHash("sha256");
  const files = inputs.filter((input) => "file" in input);
  const pending: ReturnType<typeof readHashFile>[] = [];
  let next = 0;
  const enqueue = () => {
    const input = files[next++];
    if (input) pending.push(readHashFile(input.file, contents));
  };
  // Preserve the synchronous digest's order while overlapping at most eight reads.
  for (let index = 0; index < 8; index++) enqueue();
  try {
    for (const input of inputs) {
      if ("value" in input) {
        hash.update(input.value);
        continue;
      }
      const result = await pending.shift()!;
      if ("error" in result) throw result.error;
      if (result.bytes) hash.update(result.bytes);
      else for await (const chunk of createReadStream(result.file!, { highWaterMark: chunkSize })) hash.update(chunk);
      enqueue();
    }
    return hash.digest("hex");
  } finally {
    // A failed member cannot leave prefetch I/O racing the caller's staging cleanup.
    await Promise.all(pending);
  }
};
