import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readdir, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createIndexNodeFiles } from "./index-node-files";

const folders: string[] = [];
afterEach(async () => {
  for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true });
});
const setup = async () => {
  const root = await mkdtemp(join(tmpdir(), "index-node-files-"));
  folders.push(root);
  return { root, files: createIndexNodeFiles(root) };
};
const owner = { workbenchId: "project-a", extensionId: "example.records" };
const bytes = (size: number, fill = 1) => new Uint8Array(size).fill(fill);
const ref = (blobId: string) => ({ blobId, byteLength: 1 });
const id = (name: string) => name.padEnd(16, "x");

test("a node keeps its bytes and edges, and ids differing only in case stay distinct", async () => {
  const { files } = await setup();
  await files.write(owner, "receipts", id("Node"), { bytes: bytes(3, 7), children: [ref(id("child"))] });
  await files.write(owner, "receipts", id("node"), { bytes: bytes(2, 9), children: null });
  expect(await files.read(owner, "receipts", id("Node"))).toEqual({ bytes: bytes(3, 7), children: [ref(id("child"))] });
  expect(await files.read(owner, "receipts", id("node"))).toEqual({ bytes: bytes(2, 9), children: null });
  expect(await files.read(owner, "logs", id("Node"))).toBeUndefined();
  expect((await files.list(owner, "receipts")).sort()).toEqual([id("Node"), id("node")].sort());
});

test("cache eviction removes the least recently used nodes and never a recent one", async () => {
  const { files, root } = await setup();
  for (const name of ["old", "used", "new"])
    await files.write(owner, "logs", id(name), { bytes: bytes(100), children: [] });
  const hour = Date.now() - 60 * 60 * 1000;
  const shards = join(
    root,
    Buffer.from(owner.workbenchId).toString("base64url"),
    Buffer.from(owner.extensionId).toString("base64url"),
    "logs",
  );
  for (const shard of await readdir(shards))
    for (const name of await readdir(join(shards, shard))) {
      const age = Buffer.from(name, "hex").toString() === id("new") ? Date.now() : hour;
      await utimes(join(shards, shard, name), new Date(age), new Date(age));
    }
  // Reading marks a node as used.
  await files.read(owner, "logs", id("used"));

  expect(await files.evict(owner, "logs", 150, 10 * 60 * 1000)).toBe(1);
  expect((await files.list(owner, "logs")).sort()).toEqual([id("new"), id("used")].sort());
  // Only recent nodes remain over budget, so nothing more goes.
  expect(await files.evict(owner, "logs", 0, 10 * 60 * 1000)).toBe(0);
});

test("owners move only into an empty target, removed projects lose their folders, markers persist", async () => {
  const { files, root } = await setup();
  const renamed = { ...owner, extensionId: "example.renamed" };
  await files.write(owner, "receipts", id("a"), { bytes: bytes(1), children: [] });
  await files.moveOwner(owner, renamed);
  expect(await files.list(renamed, "receipts")).toEqual([id("a")]);
  expect(await files.list(owner, "receipts")).toEqual([]);

  await files.write(owner, "receipts", id("b"), { bytes: bytes(1), children: [] });
  await files.moveOwner(owner, renamed);
  expect(await files.list(renamed, "receipts")).toEqual([id("a")]);

  const other = { workbenchId: "project-b", extensionId: "example.records" };
  await files.write(other, "logs", id("c"), { bytes: bytes(1), children: [] });
  await files.marker("upgrade").set();
  await files.retainProjects(new Set([owner.workbenchId]));
  expect(await files.list(other, "logs")).toEqual([]);
  expect(await files.list(renamed, "receipts")).toEqual([id("a")]);
  expect(await createIndexNodeFiles(root).marker("upgrade").exists()).toBe(true);
  await files.marker("upgrade").clear();
  expect(await files.marker("upgrade").exists()).toBe(false);
});
