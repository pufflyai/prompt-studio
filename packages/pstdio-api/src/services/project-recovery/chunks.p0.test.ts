import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createRecoveryChunkStore, recoveryChunkBytes } from "./chunks";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
const store = async (owner = "account-a", secret = "A".repeat(43), root?: string) => {
  root ??= await mkdtemp(join(tmpdir(), "recovery-chunks-"));
  roots.push(root);
  return createRecoveryChunkStore({
    root,
    space: await createSyncSpace({ projectId: "project", spaceOwner: owner, keys: [{ generation: 1, secret }] }),
  });
};

test("recovery chunks retain ciphertext references across restart and never store plaintext bytes", async () => {
  const chunks = await store();
  const plain = new TextEncoder().encode("private .env content that must remain encrypted");
  const first = await chunks.stage(plain);
  expect(await chunks.stage(plain)).toEqual(first);
  expect(await chunks.read(first)).toEqual(plain);
  const wire = await chunks.encrypted(first);
  expect(new TextDecoder().decode(wire)).not.toContain("private .env content");
  const reopened = await createRecoveryChunkStore({ root: chunks.root, space: chunks.space });
  expect(await reopened.stage(plain)).toEqual(first);
  expect(await reopened.read(first)).toEqual(plain);
});

test("another device can verify retained chunks but another account cannot decrypt them", async () => {
  const first = await store();
  const second = await store();
  const other = await store("account-b", "B".repeat(43));
  const plain = new Uint8Array([0, 255, 1, 128]);
  const reference = await first.stage(plain);
  const encrypted = await first.encrypted(reference);
  await second.receive(reference, encrypted);
  expect(await second.read(reference)).toEqual(plain);
  await expect(other.receive(reference, encrypted)).rejects.toThrow();
  expect((await other.stage(plain)).blobId).not.toBe(reference.blobId);
});

test("a changed ciphertext or declared extent never becomes a complete recovery chunk", async () => {
  const first = await store();
  const second = await store();
  const reference = await first.stage(new TextEncoder().encode("intact"));
  const encrypted = await first.encrypted(reference);
  encrypted[encrypted.length - 1] ^= 1;
  await expect(second.receive(reference, encrypted)).rejects.toThrow();
  await expect(
    second.receive({ ...reference, byteLength: reference.byteLength + 1 }, await first.encrypted(reference)),
  ).rejects.toThrow();
  const path = join(first.directory, `${reference.blobId}.blob`);
  const bytes = await readFile(path);
  bytes[bytes.length - 1] ^= 1;
  await writeFile(path, bytes);
  await expect(first.read(reference)).rejects.toThrow();
});

test("staging keeps one bounded chunk and refuses a project-wide encryption audience", async () => {
  const chunks = await store();
  const full = new Uint8Array(recoveryChunkBytes).fill(27);
  expect(await chunks.read(await chunks.stage(full))).toEqual(full);
  await expect(chunks.stage(new Uint8Array(recoveryChunkBytes + 1))).rejects.toThrow();
  const space = await createSyncSpace({
    projectId: "project",
    spaceOwner: null,
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  await expect(createRecoveryChunkStore({ root: chunks.root, space })).rejects.toThrow();
});

test("file bytes matching a manifest page keep an independent immutable retention role", async () => {
  const chunks = await store();
  const bytes = new TextEncoder().encode('{"version":1,"kind":"file-leaf","parts":[]}');
  const content = await chunks.stage(bytes);
  const metadata = await chunks.stage(bytes, "metadata");
  expect(metadata.blobId).not.toBe(content.blobId);
  expect(await chunks.read(content)).toEqual(await chunks.read(metadata));
});
