import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createEncryptedManifestNodes } from "pstdio-sync/relay";
import { createIndexNodeFiles } from "./index-node-files";
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
