import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, unlink } from "node:fs/promises";
import { join } from "node:path";
import { openBlob, type SyncSpace, sealBlob } from "pstdio-sync/encryption";
import { syncIdSchema } from "pstdio-sync-contracts";
import { z } from "zod";

export const recoveryChunkBytes = 1024 * 1024;
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const recoveryChunkSchema = z.strictObject({
  blobId: syncIdSchema,
  byteLength: z.number().int().min(0).max(recoveryChunkBytes),
  sha256: digestSchema,
  encryptedByteLength: z
    .number()
    .int()
    .min(1)
    .max(recoveryChunkBytes + 256),
  encryptedSha256: digestSchema,
});
const referenceSchema = recoveryChunkSchema;
export type RecoveryChunk = z.infer<typeof recoveryChunkSchema>;

const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";

const readBounded = async (path: string, limit: number) => {
  const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const before = await file.stat({ bigint: true });
    if (!before.isFile() || before.size > BigInt(limit)) throw new Error("Invalid retained recovery chunk");
    // Read a bounded buffer even if a file grows after stat. A cache file is never a plaintext source.
    const bytes = new Uint8Array(Number(before.size) + 1);
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await file.read(bytes, offset, bytes.length - offset, offset);
      if (!bytesRead) break;
      offset += bytesRead;
    }
    const after = await file.stat({ bigint: true });
    if (offset !== Number(before.size) || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs)
      throw new Error("A retained recovery chunk changed while reading");
    return bytes.slice(0, offset);
  } finally {
    await file.close();
  }
};

/** Publish an immutable cache file without replacing another writer's completed copy. */
const retain = async (path: string, bytes: Uint8Array) => {
  const temporary = `${path}.${crypto.randomUUID()}.pending`;
  const file = await open(temporary, "wx", 0o600);
  try {
    await file.writeFile(bytes);
    await file.sync();
    try {
      await link(temporary, path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  } finally {
    await file.close();
    await unlink(temporary);
  }
};

/** Device-local ciphertext cache. Plaintext lives only in one bounded in-memory chunk.
 * Naming and AEAD both use the account's private project space, never the shared project audience. */
export const createRecoveryChunkStore = async ({ root, space }: { root: string; space: SyncSpace }) => {
  if (!space.spaceOwner) throw new Error("Folder recovery requires the account's private project space");
  const namespace = await space.documentId(JSON.stringify(["folder-recovery", space.projectId, space.spaceOwner]));
  const directory = join(root, namespace);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (!(await lstat(directory)).isDirectory()) throw new Error("Invalid recovery cache directory");
  const active = new Map<string, Promise<RecoveryChunk>>();
  const path = (reference: RecoveryChunk) => join(directory, `${reference.blobId}.blob`);
  const encrypted = async (input: RecoveryChunk) => {
    const reference = referenceSchema.parse(input);
    const bytes = await readBounded(path(reference), reference.encryptedByteLength);
    if (bytes.length !== reference.encryptedByteLength || hash(bytes) !== reference.encryptedSha256)
      throw new Error("Recovery ciphertext does not match its complete reference");
    return bytes;
  };
  const verify = async (input: RecoveryChunk, bytes: Uint8Array) => {
    const reference = referenceSchema.parse(input);
    if (bytes.length !== reference.encryptedByteLength || hash(bytes) !== reference.encryptedSha256)
      throw new Error("Recovery ciphertext does not match its complete reference");
    const plain = await openBlob(space, reference.blobId, bytes);
    if (plain.length !== reference.byteLength || hash(plain) !== reference.sha256)
      throw new Error("Recovery plaintext does not match its complete reference");
    return plain;
  };
  const read = async (reference: RecoveryChunk) => verify(reference, await encrypted(reference));
  const stage = async (plain: Uint8Array, role: "content" | "metadata" = "content") => {
    if (plain.length > recoveryChunkBytes) throw new Error("Recovery chunks must remain bounded");
    const sha256 = hash(plain);
    const key = await space.documentId(JSON.stringify(["recovery-chunk", space.generation, role, sha256]));
    const pending = active.get(key);
    if (pending) return pending;
    const work = (async () => {
      const descriptor = join(directory, `${key}.json`);
      try {
        const saved = referenceSchema.parse(JSON.parse(new TextDecoder().decode(await readBounded(descriptor, 1024))));
        if (saved.sha256 !== sha256 || saved.byteLength !== plain.length)
          throw new Error("Invalid recovery cache reference");
        await read(saved);
        return saved;
      } catch (error) {
        if (!missing(error)) throw error;
      }
      const sealed = await sealBlob(space, plain);
      const reference = referenceSchema.parse({
        blobId: sealed.blobId,
        byteLength: plain.length,
        sha256,
        encryptedByteLength: sealed.bytes.length,
        encryptedSha256: hash(sealed.bytes),
      });
      await retain(path(reference), sealed.bytes);
      await retain(descriptor, new TextEncoder().encode(JSON.stringify(reference)));
      // A concurrent process may have retained the same content first.
      const saved = referenceSchema.parse(JSON.parse(new TextDecoder().decode(await readBounded(descriptor, 1024))));
      await read(saved);
      return saved;
    })();
    active.set(key, work);
    try {
      return await work;
    } finally {
      if (active.get(key) === work) active.delete(key);
    }
  };
  return {
    root,
    directory,
    space,
    stage,
    encrypted,
    read,
    /** Whether the complete ciphertext is retained, without reading it. `read` still verifies it. */
    async has(input: RecoveryChunk) {
      const reference = referenceSchema.parse(input);
      const stat = await lstat(path(reference)).catch(() => null);
      return !!stat?.isFile() && stat.size === reference.encryptedByteLength;
    },
    async receive(input: RecoveryChunk, bytes: Uint8Array) {
      const reference = referenceSchema.parse(input);
      await verify(reference, bytes);
      await retain(path(reference), bytes);
      await read(reference);
    },
  };
};
