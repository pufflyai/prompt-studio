import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, like } from "drizzle-orm";
import { createDb } from "../../db/connection.pglite";
import { documents, owners } from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture, populateExtensionStorageFixture } from "./extension-storage.fixture";
import { withOrderedOwner } from "./ordered-journal";
import { readOrderedMarker, saveOrderedMarker } from "./ordered-native-metadata";
import { encodeOrderedJson, orderedOwnerWhere } from "./ordered-sql";
import { retainedHash, retainedPageBytes, retainedPageKey, retainedValueKey } from "./retained-page-format";
import { createRetainedPages } from "./retained-pages";

test("private retained pages split bounded groups, preserve large identities and never become shared documents", async () => {
  const f = await createExtensionStorageFixture();
  const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
  const other = { ...owner, extensionId: "example.other" };
  const storage = createDocumentStorageDBService(f.db);
  const largeKey = "日本語\0".repeat(20_000);
  const large = { text: "retained\0日本語".repeat(2_000), order: { z: 1, a: 2 } };
  try {
    await withOrderedOwner(f.db, owner, async (_journal, tx) => {
      const pages = createRetainedPages<unknown>(tx, owner, "tombstones");
      for (let start = 0; start < 300; start += 100)
        await pages.set(
          Array.from({ length: 100 }, (_, i) => ({ key: `record-${start + i}`, value: { n: start + i } })),
        );
      await pages.set([
        { key: "id-\ud800", value: "first" },
        { key: "id-\ud801", value: "second" },
      ]);
      expect(await pages.get("id-\ud800")).toBe("first");
      expect(await pages.get("id-\ud801")).toBe("second");
      const input = [
        { key: largeKey, value: structuredClone(large) },
        { key: "large-value", value: structuredClone(large) },
      ];
      const saved = pages.set(input);
      input[0]!.value.text = "changed after capture";
      await saved;
      expect(await pages.get(largeKey)).toEqual(large);
      expect(await pages.get("record-299")).toEqual({ n: 299 });
      expect(await pages.get("absent")).toBeUndefined();
      expect(await createRetainedPages(tx, owner, "authorship").get("record-299")).toBeUndefined();
      expect(await createRetainedPages(tx, other, "tombstones").get("record-299")).toBeUndefined();
      const rows = await tx
        .select()
        .from(documents)
        .where(
          and(orderedOwnerWhere(documents, owner), like(documents.key, '["ordered-retention","tombstones","page",%')),
        );
      expect(rows.length).toBeGreaterThan(1);
      expect(rows.length).toBeLessThan(100);
      for (const row of rows) {
        const page = (await readOrderedMarker(tx, owner, row.key))!.value;
        expect(encodeOrderedJson(page).byteLength).toBeLessThanOrEqual(retainedPageBytes);
      }
    });
    expect(await storage.documents.list(owner)).toEqual(["records"]);
    // Recovery values remain user data even though their private documents stay hidden.
    expect(await storage.hasData(owner)).toBe(true);
    expect(await storage.hasData(other)).toBe(false);
    const key = retainedPageKey("tombstones", "");
    await expect(storage.documents.open(key).transaction(owner, async () => {})).rejects.toThrow("Private");
    await expect(storage.documents.discard(owner, key)).rejects.toThrow("Private");
    await expect(storage.documents.open(key).revision(owner)).rejects.toThrow("Private");
    await withOrderedOwner(f.db, owner, async (_journal, tx) => {
      const pages = createRetainedPages(tx, owner, "tombstones");
      await pages.set([{ key: "large-value", value: { text: "small again" } }]);
      expect(await pages.get("large-value")).toEqual({ text: "small again" });
      expect(
        await readOrderedMarker(tx, owner, retainedValueKey("tombstones", retainedHash("large-value"))),
      ).toBeUndefined();
    });
  } finally {
    await storage.flushStatistics();
    await f.svc.flushStatistics();
    await f.close();
  }
});

test("retained page changes roll back together and owner deletion prevents an old generation from returning", async () => {
  const f = await createExtensionStorageFixture();
  const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
  try {
    await withOrderedOwner(f.db, owner, async (_journal, tx) => {
      await createRetainedPages(tx, owner, "authorship").set([{ key: "command", value: { original: true } }]);
    });
    expect(await createDocumentStorageDBService(f.db).hasData(owner)).toBe(false);
    await expect(
      withOrderedOwner(f.db, owner, async (_journal, tx) => {
        const pages = createRetainedPages(tx, owner, "authorship");
        await pages.set([
          { key: "command", value: "x".repeat(20_000) },
          { key: "new", value: 42 },
        ]);
        throw new Error("rollback retained changes");
      }),
    ).rejects.toThrow("rollback retained changes");
    await withOrderedOwner(f.db, owner, async (_journal, tx) => {
      const pages = createRetainedPages(tx, owner, "authorship");
      expect(await pages.get("command")).toEqual({ original: true });
      expect(await pages.get("new")).toBeUndefined();
      await tx.delete(owners).where(orderedOwnerWhere(owners, owner));
    });
    await withOrderedOwner(f.db, owner, async (_journal, tx) => {
      expect(await createRetainedPages(tx, owner, "authorship").get("command")).toBeUndefined();
    });
  } finally {
    await f.svc.flushStatistics();
    await f.close();
  }
});

test("private disk retention survives reopening and damaged or missing child pages fail closed", async () => {
  const root = await mkdtemp(join(tmpdir(), "retained-pages-"));
  const path = join(root, "database");
  let connection = await createDb({ path });
  const f = await populateExtensionStorageFixture(connection);
  const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
  const read = () =>
    withOrderedOwner(connection.db, owner, async (_journal, tx) =>
      createRetainedPages(tx, owner, "tombstones").get("record"),
    );
  try {
    await withOrderedOwner(connection.db, owner, async (_journal, tx) => {
      await createRetainedPages(tx, owner, "tombstones").set([
        { key: "record", value: { body: "before deletion", stamps: ["exact"] } },
      ]);
    });
    await f.svc.flushStatistics();
    await connection.close();
    connection = await createDb({ path });
    expect(await read()).toEqual({ body: "before deletion", stamps: ["exact"] });
    await withOrderedOwner(connection.db, owner, async (_journal, tx) => {
      await saveOrderedMarker(tx, owner, retainedPageKey("tombstones", ""), {
        version: 1,
        type: "branch",
        children: [retainedHash("record")[0]],
      });
    });
    await expect(read()).rejects.toThrow("retained page is missing");
    await withOrderedOwner(connection.db, owner, async (_journal, tx) => {
      await saveOrderedMarker(tx, owner, retainedPageKey("tombstones", ""), {
        version: 1,
        type: "leaf",
        entries: [{ hash: "broken", content: { external: true } }],
      });
    });
    await expect(read()).rejects.toThrow("Invalid retained page address");
  } finally {
    await connection.close();
    await rm(root, { recursive: true, force: true });
  }
});
