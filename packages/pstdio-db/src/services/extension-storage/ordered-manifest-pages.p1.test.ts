import { expect, test } from "bun:test";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createEncryptedManifestNodes } from "pstdio-sync/relay";
import { createDb } from "../../db/connection.pglite";
import { projects, storage_documents } from "../../db/schemas.pg";
import { createOrderedManifestCache } from "./ordered-receipts-blobs";
import { createRelay } from "./record-stream-relay.fixture";

for (const scope of ["page", "owner transaction"] as const) {
  test(`a manifest ${scope} rolls back incomplete recovery data and durably retains a complete graph`, async () => {
    const { db, close } = await createDb({ path: ":memory:" });
    try {
      const id = crypto.randomUUID();
      const owner = { workbenchId: id, extensionId: "example.logs" };
      const now = new Date().toISOString();
      await db
        .insert(projects)
        .values({ id, name: "Manifest pages", shorthand: "M", created_at: now, updated_at: now });
      const space = await createSyncSpace({
        projectId: id,
        spaceOwner: null,
        keys: [{ generation: 1, secret: "A".repeat(43) }],
      });
      const relay = createRelay();
      const remote = await relay.relay.manifestBlobs();
      const cache = createOrderedManifestCache(db, owner, space, remote);
      const nodes = createEncryptedManifestNodes(space, cache.blobs);
      const page = <T>(run: () => Promise<T>) => {
        if (scope === "page") return cache.blobs.batch!(run);
        return db.transaction((tx) => cache.transaction(tx, () => cache.blobs.batch!(run)));
      };
      const error = await page(async () => {
        await Promise.all([nodes.write({ title: "Incomplete one" }, []), nodes.write({ title: "Incomplete two" }, [])]);
        throw new Error("Page interrupted");
      }).catch((error: unknown) => error);
      expect(error).toMatchObject({ message: "Page interrupted" });
      expect(await db.select().from(storage_documents)).toEqual([]);

      const root = await page(async () => {
        const children = await Promise.all(
          Array.from({ length: 100 }, (_, index) => nodes.write({ title: `Saved ${index}` }, [])),
        );
        return nodes.write({ children }, children);
      });
      relay.loseBlobs();
      const reopened = createOrderedManifestCache(db, owner, space, remote);
      await reopened.replay(root);
      const reader = createEncryptedManifestNodes(space, remote);
      const restored = (await reader.read(root)) as { children: { blobId: string; byteLength: number }[] };
      expect(restored.children).toHaveLength(100);
      expect(await reader.read(restored.children[99]!)).toEqual({ title: "Saved 99" });
      expect(relay.blobIds()).toHaveLength(101);
    } finally {
      await close();
    }
  });
}
