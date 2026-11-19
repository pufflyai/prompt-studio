import { afterEach, expect, spyOn, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createEncryptedManifestNodes } from "pstdio-sync/relay";
import { createIndexNodeFiles, createMemoryIndexNodeFiles } from "./index-node-files";
import { createLogIndexCache } from "./log-index-cache";
import { createRelay } from "./record-stream-relay.fixture";

const folders: string[] = [];
afterEach(async () => {
  for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true });
});

test("log index nodes are a bounded cache that keeps fresh writes and downloads evicted nodes again", async () => {
  const root = await mkdtemp(join(tmpdir(), "log-index-cache-"));
  folders.push(root);
  const files = createIndexNodeFiles(root);
  const owner = { workbenchId: crypto.randomUUID(), extensionId: "example.history" };
  const space = await createSyncSpace({
    projectId: owner.workbenchId,
    spaceOwner: null,
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const remote = await createRelay().relay.manifestBlobs();
  // A zero budget would evict everything at once; fresh nodes still stay so a write and its edges never split.
  const nodes = createEncryptedManifestNodes(space, createLogIndexCache(files, owner, space, remote, 0));
  const written = await Promise.all(Array.from({ length: 70 }, (_, index) => nodes.write({ page: index }, [])));
  await Bun.sleep(10);
  expect(await files.list(owner, "logs")).toHaveLength(70);
  expect(await files.list(owner, "receipts")).toEqual([]);

  await files.remove(owner, "logs", [written[0]!.blobId]);
  const reader = createEncryptedManifestNodes(space, createLogIndexCache(files, owner, space, remote, 0));
  expect(await reader.read(written[0]!)).toEqual({ page: 0 });
  expect(await files.read(owner, "logs", written[0]!.blobId)).toBeDefined();
});

test("a damaged or evicted cache node is downloaded again, even between a read and its edge validation", async () => {
  const root = await mkdtemp(join(tmpdir(), "log-index-cache-"));
  folders.push(root);
  const files = createIndexNodeFiles(root);
  const owner = { workbenchId: crypto.randomUUID(), extensionId: "example.history" };
  const space = await createSyncSpace({
    projectId: owner.workbenchId,
    spaceOwner: null,
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const remote = await createRelay().relay.manifestBlobs();
  const writer = createEncryptedManifestNodes(space, createLogIndexCache(files, owner, space, remote));
  const leaf = await writer.write({ page: "leaf" }, []);
  const root2 = await writer.write({ children: [leaf] }, [leaf]);

  // A torn write keeps a valid header but loses bytes.
  const node = await files.read(owner, "logs", leaf.blobId);
  await files.remove(owner, "logs", [leaf.blobId]);
  await files.create(owner, "logs", leaf.blobId, { bytes: node!.bytes.slice(0, 3), children: null });
  const cache = createLogIndexCache(files, owner, space, remote);
  expect(await createEncryptedManifestNodes(space, cache).read(leaf)).toEqual({ page: "leaf" });

  // Eviction between a read and remember() costs a download, not a failed sync.
  await files.remove(owner, "logs", [root2.blobId]);
  await cache.remember!(root2, [leaf]);
  expect(await files.edges(owner, "logs", root2.blobId)).toEqual([leaf]);
});

test("eviction is counted per owner across caches and a failed eviction never throws", async () => {
  const owner = { workbenchId: crypto.randomUUID(), extensionId: "example.history" };
  const space = await createSyncSpace({
    projectId: owner.workbenchId,
    spaceOwner: null,
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const remote = await createRelay().relay.manifestBlobs();
  const files = createMemoryIndexNodeFiles();
  let evictions = 0;
  const failing = {
    ...files,
    evict: async () => {
      evictions++;
      throw new Error("disk went away");
    },
  };
  const warning = spyOn(console, "warn").mockImplementation(() => {});
  try {
    // Each sync builds a new cache; 64 writes spread over many caches still trigger one check.
    for (let index = 0; index < 64; index++) {
      const nodes = createEncryptedManifestNodes(space, createLogIndexCache(failing, owner, space, remote, 0));
      await nodes.write({ page: index }, []);
    }
    await Bun.sleep(10);
    expect(evictions).toBe(1);
    expect(warning).toHaveBeenCalled();
  } finally {
    warning.mockRestore();
  }
});
