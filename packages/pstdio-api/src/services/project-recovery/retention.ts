import { readdir, readFile, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { type RecoveryChunk, recoveryChunkSchema } from "./chunks";
import { recoveryFileCacheSchema, recoveryFileCacheSuffix } from "./file-cache";
import type { RecoveryChunkStore } from "./manifest";
import { walkRecoveryGraph } from "./transfer-graph";

const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";

// Chunk descriptors name their blob; unchanged-file entries name their content root.
const descriptorReachable = async (path: string, reachable: Set<string>) => {
  try {
    const value = JSON.parse(await readFile(path, "utf8"));
    const blobId = path.endsWith(recoveryFileCacheSuffix)
      ? recoveryFileCacheSchema.safeParse(value).data?.content?.blobId
      : recoveryChunkSchema.safeParse(value).data?.blobId;
    return !!blobId && reachable.has(blobId);
  } catch (error) {
    if (missing(error) || error instanceof SyntaxError) return false;
    throw error;
  }
};

/** The local recovery store keeps the graphs of current catalog roots and the
 * pending candidate. Like the relay's R20 grace copy, superseded ciphertext stays
 * for `graceMs` so concurrent staging and downloads are never removed. A root whose
 * metadata pages are not local stops pruning before anything is removed. */
export const pruneRecoveryStore = async (input: {
  chunks: RecoveryChunkStore;
  roots: RecoveryChunk[];
  graceMs: number;
}) => {
  const reachable = new Set<string>();
  for (const root of input.roots)
    await walkRecoveryGraph({
      chunks: input.chunks,
      root,
      before: async (reference) => {
        reachable.add(reference.blobId);
      },
    });
  const cutoff = Date.now() - input.graceMs;
  const expired = async (path: string) => {
    try {
      return (await stat(path)).mtimeMs <= cutoff;
    } catch (error) {
      if (missing(error)) return false;
      throw error;
    }
  };
  const remove = async (path: string) => {
    await unlink(path).catch((error) => {
      if (!missing(error)) throw error;
    });
  };
  let removed = 0;
  for (const name of await readdir(input.chunks.directory)) {
    const path = join(input.chunks.directory, name);
    if (!(await expired(path))) continue;
    if (name.endsWith(".pending")) await remove(path);
    else if (name.endsWith(".blob")) {
      if (reachable.has(name.slice(0, -".blob".length))) continue;
      await remove(path);
      removed++;
    } else if (name.endsWith(".json")) {
      if (await descriptorReachable(path, reachable)) continue;
      await remove(path);
    }
  }
  return { removed };
};
