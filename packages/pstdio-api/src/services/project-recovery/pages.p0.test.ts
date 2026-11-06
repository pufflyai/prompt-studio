import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createRecoveryChunkStore } from "./chunks";
import { createRecoveryPages } from "./pages";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "recovery-pages-"));
  roots.push(root);
  const space = await createSyncSpace({
    projectId: "project",
    spaceOwner: "account",
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const chunks = await createRecoveryChunkStore({ root, space });
  return { chunks, pages: createRecoveryPages(chunks) };
};

test("bounded inventory pages preserve exact paths, metadata, symlinks and order across restart", async () => {
  const { chunks, pages } = await fixture();
  const entries = Array.from({ length: 270 }, (_, index) => ({
    kind: "directory" as const,
    path: `private/empty-${index}`,
    mode: 0o750,
  }));
  const writer = pages.inventory();
  for (const entry of entries) await writer.add(entry);
  await writer.add({ kind: "symlink", path: "outside", target: "../../unrelated", mode: 0o777 });
  const root = await writer.finish();
  const reopened = createRecoveryPages(await createRecoveryChunkStore({ root: chunks.root, space: chunks.space }));
  const restored = [];
  for await (const entry of reopened.entries(root)) restored.push(entry);
  expect(restored).toEqual([...entries, { kind: "symlink", path: "outside", target: "../../unrelated", mode: 0o777 }]);
  const header = await reopened.read(root);
  expect(header.kind).toBe("inventory-branch");
  expect(JSON.stringify(header).length).toBeLessThan(1024 * 1024);
});

test("file pages preserve repeated content references and authenticated byte counts", async () => {
  const { chunks, pages } = await fixture();
  const part = await chunks.stage(new TextEncoder().encode("repeated"));
  const writer = pages.file();
  for (let index = 0; index < 270; index++) await writer.add(part);
  const root = await writer.finish();
  const found = [];
  for await (const reference of pages.parts(root)) found.push(reference);
  expect(found).toEqual(Array.from({ length: 270 }, () => part));
  expect(found.reduce((sum, reference) => sum + reference.byteLength, 0)).toBe(2160);
  const empty = await pages.file().finish();
  expect(empty).toBeNull();
});

test("a malformed inventory never becomes a valid restore source", async () => {
  const { chunks, pages } = await fixture();
  const root = await chunks.stage(
    new TextEncoder().encode(
      JSON.stringify({ kind: "inventory-leaf", version: 1, entries: [{ kind: "file", path: "missing-data" }] }),
    ),
  );
  await expect(pages.read(root)).rejects.toThrow();
  const unknown = await chunks.stage(new TextEncoder().encode('{"kind":"unknown","version":1}'));
  await expect(pages.read(unknown)).rejects.toThrow();
});
