import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createEncryptedManifestNodes } from "pstdio-sync/relay";
import { createDb } from "../../db/connection.pglite";
import { projects, storage_documents } from "../../db/schemas.pg";
import { createIndexNodeFiles } from "./index-node-files";
import { collectOrderedReceiptNodes, createOrderedManifestCache } from "./ordered-receipts-blobs";
import { createRelay } from "./record-stream-relay.fixture";

const setup = async () => {
  const { db, close } = await createDb({ path: ":memory:" });
  const folder = await mkdtemp(join(tmpdir(), "index-nodes-"));
  const id = crypto.randomUUID();
  const owner = { workbenchId: id, extensionId: "example.records" };
  const now = new Date().toISOString();
  await db.insert(projects).values({ id, name: "Manifest pages", shorthand: "M", created_at: now, updated_at: now });
  const space = await createSyncSpace({
    projectId: id,
    spaceOwner: null,
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const relay = createRelay();
  const remote = await relay.relay.manifestBlobs();
  return {
    db,
    owner,
    space,
    relay,
    remote,
    folder,
    // Each call reads the same folder again, as a restarted runtime would.
    files: () => createIndexNodeFiles(folder),
    async close() {
      await close();
      await rm(folder, { recursive: true, force: true });
    },
  };
};

test("index nodes live in files, never in database rows, and a complete graph replays after relay loss", async () => {
  const context = await setup();
  try {
    const cache = createOrderedManifestCache(context.files(), context.owner, "receipts", context.space, context.remote);
    const nodes = createEncryptedManifestNodes(context.space, cache.blobs);
    const children = await Promise.all(
      Array.from({ length: 100 }, (_, index) => nodes.write({ title: `Saved ${index}` }, [])),
    );
    const root = await nodes.write({ children }, children);
    expect(await context.db.select().from(storage_documents)).toEqual([]);

    // Replaying while the relay still holds the graph repeats each upload with its original child order.
    const restarted = createOrderedManifestCache(
      context.files(),
      context.owner,
      "receipts",
      context.space,
      context.remote,
    );
    await restarted.replay(root);

    context.relay.loseBlobs();
    await restarted.replay(root);
    const reader = createEncryptedManifestNodes(context.space, context.remote);
    const restored = (await reader.read(root)) as { children: { blobId: string; byteLength: number }[] };
    expect(restored.children).toHaveLength(100);
    expect(await reader.read(restored.children[99]!)).toEqual({ title: "Saved 99" });
    expect(context.relay.blobIds()).toHaveLength(101);
  } finally {
    await context.close();
  }
});

test("collection keeps every node a saved root reaches and removes interrupted and replaced nodes", async () => {
  const context = await setup();
  try {
    const files = context.files();
    const cache = createOrderedManifestCache(files, context.owner, "receipts", context.space, context.remote);
    const nodes = createEncryptedManifestNodes(context.space, cache.blobs);
    // An interrupted page leaves nodes that no saved root names.
    await Promise.all([nodes.write({ title: "Interrupted one" }, []), nodes.write({ title: "Interrupted two" }, [])]);
    const shared = await nodes.write({ title: "Shared" }, []);
    const replaced = await nodes.write({ children: [shared] }, [shared]);
    const root = await nodes.write({ children: [shared], version: 2 }, [shared]);
    const published = await nodes.write({ children: [shared], published: true }, [shared]);

    const result = await collectOrderedReceiptNodes(files, context.owner, async () => [root, published]);
    expect(result).toEqual({ kept: 3, removed: 3 });
    expect((await files.list(context.owner, "receipts")).sort()).toEqual(
      [shared.blobId, root.blobId, published.blobId].sort(),
    );
    expect(await files.read(context.owner, "receipts", replaced.blobId)).toBeUndefined();

    context.relay.loseBlobs();
    const restarted = createOrderedManifestCache(
      context.files(),
      context.owner,
      "receipts",
      context.space,
      context.remote,
    );
    await restarted.replay(root);
    await restarted.replay(published);
    expect(context.relay.blobIds().sort()).toEqual([shared.blobId, root.blobId, published.blobId].sort());
  } finally {
    await context.close();
  }
});

test("collection treats nodes with unknown edges as leaves and keeps them", async () => {
  const context = await setup();
  try {
    const files = context.files();
    const writer = createOrderedManifestCache(files, context.owner, "receipts", context.space, context.remote);
    const nodes = createEncryptedManifestNodes(context.space, writer.blobs);
    const child = await nodes.write({ title: "Child" }, []);
    const root = await nodes.write({ children: [child] }, [child]);
    // A node downloaded but not yet validated has no recorded edges.
    const node = await files.read(context.owner, "receipts", root.blobId);
    await files.write(context.owner, "receipts", root.blobId, { bytes: node!.bytes, children: null });

    expect(await collectOrderedReceiptNodes(files, context.owner, async () => [root])).toEqual({ kept: 1, removed: 1 });
    expect(await files.read(context.owner, "receipts", root.blobId)).toBeDefined();
    // The child is still on the relay, so reading through the root downloads it again.
    const reader = createOrderedManifestCache(files, context.owner, "receipts", context.space, context.remote);
    const readNodes = createEncryptedManifestNodes(context.space, reader.blobs);
    expect(await readNodes.read(child)).toEqual({ title: "Child" });
  } finally {
    await context.close();
  }
});
