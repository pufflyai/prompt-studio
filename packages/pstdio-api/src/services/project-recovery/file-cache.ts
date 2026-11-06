import { open, readFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { recoveryChunkSchema } from "./chunks";
import type { RecoveryChunkStore } from "./manifest";

export const recoveryFileCacheSuffix = ".file.json";
export const recoveryFileCacheSchema = z.strictObject({
  size: z.number().int().nonnegative().safe(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  content: recoveryChunkSchema.nullable(),
});
type CachedFile = z.infer<typeof recoveryFileCacheSchema>;

/** Encrypted content of a file whose source identity (device, inode, size, change
 * and modification times) is unchanged since a previous capture. The cache key is a
 * private-space HMAC, so local file names reveal no paths. The final verification
 * pass still re-checks every identity before a capture completes. */
export const createRecoveryFileCache = (chunks: RecoveryChunkStore) => {
  const path = async (source: string, identity: string[]) =>
    join(
      chunks.directory,
      `${await chunks.space.documentId(JSON.stringify(["recovery-file", chunks.space.generation, source, identity]))}${recoveryFileCacheSuffix}`,
    );
  return {
    async get(source: string, identity: string[]): Promise<CachedFile | null> {
      try {
        const cached = recoveryFileCacheSchema.parse(JSON.parse(await readFile(await path(source, identity), "utf8")));
        // The file's page root must still be retained; its parts are verified before publication.
        if (cached.content) await chunks.encrypted(cached.content);
        return cached;
      } catch {
        return null;
      }
    },
    async set(source: string, identity: string[], value: CachedFile) {
      const target = await path(source, identity);
      const temporary = `${target}.${crypto.randomUUID()}.pending`;
      const file = await open(temporary, "wx", 0o600);
      try {
        await file.writeFile(JSON.stringify(recoveryFileCacheSchema.parse(value)));
      } finally {
        await file.close();
      }
      await rename(temporary, target);
    },
  };
};
