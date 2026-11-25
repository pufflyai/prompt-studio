import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { createDb } from "../../db/connection.pglite";
import { records } from "../../db/schemas.pg";
import { compactOrderedTombstones } from "./compact-tombstones";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { withOrderedOwner } from "./ordered-journal";
import { readOrderedMarker, saveOrderedMarker } from "./ordered-native-metadata";
import { orderedOwnerWhere } from "./ordered-sql";
import { retainedPageKey } from "./retained-page-format";
import { createRetainedPages } from "./retained-pages";

test("tombstone compaction removes SQL bodies while restoring the exact saved value and canonical observation", async () => {
  const f = await createExtensionStorageFixture();
  const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
  const storage = createDocumentStorageDBService(f.db);
  const store = storage.open({ owner }).records;
  const value = { z: "retained日本語\0", a: { first: "\ud800", second: "\ud801" } };
  try {
    await store.commit({ operationId: "seed", edits: [{ recordId: "card", replace: value }] });
    await store.commit({ operationId: "delete", edits: [{ recordId: "card", deleted: true }] });
    const before = await withOrderedOwner(f.db, owner, async (journal) =>
      (await journal.canonical(["card"])).get("card"),
    );
    const visible = await store.read("card");
    await compactOrderedTombstones(f.db, owner);
    const [row] = await f.db
      .select()
      .from(records)
      .where(and(orderedOwnerWhere(records, owner), eq(records.record_id, "card")));
    expect(row!.value).toBeNull();
    expect(row!.asset).toBeNull();
    expect(row!.shared).toBeNull();
    expect(await store.read("card")).toEqual(visible);
    const after = await withOrderedOwner(f.db, owner, async (journal) =>
      (await journal.canonical(["card"])).get("card"),
    );
    expect(after).toEqual(before);
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
    await store.commit({ operationId: "restore", edits: [{ recordId: "card", deleted: false }] });
    expect((await store.read("card")).value).toEqual(value);
    await withOrderedOwner(f.db, owner, async (_journal, tx) => {
      expect(await createRetainedPages(tx, owner, "tombstones").get("card")).toBeUndefined();
    });
  } finally {
    await storage.flushStatistics();
    await f.svc.flushStatistics();
    await f.close();
  }
});

test("a compacted native record survives a disk restart and damaged retention refuses restore atomically", async () => {
  const root = await mkdtemp(join(tmpdir(), "retained-records-"));
  const path = join(root, "database");
  const f = await createExtensionStorageFixture(path);
  const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
  let connection = { db: f.db, close: f.close };
  let storage = createDocumentStorageDBService(connection.db);
  const open = () => storage.open({ owner, textFields: [{ prefix: "card", fields: ["/description"] }] }).records;
  const key = "a".repeat(64);
  try {
    await open().commit({
      operationId: "seed-native",
      edits: [{ recordId: "card", replace: { description: "native 日本語" } }],
    });
    await open().bindText({ recordId: "card", field: "/description", documentKey: key });
    await storage.openNativeTextDocument({ owner, fileId: key }).save("edited native 日本語");
    await open().commit({ operationId: "retire-native", edits: [{ recordId: "card", deleted: true }] });
    const canonical = await withOrderedOwner(connection.db, owner, async (journal) =>
      (await journal.canonical(["card"])).get("card"),
    );
    expect(canonical!.texts).toBeDefined();
    await compactOrderedTombstones(connection.db, owner);
    await storage.flushStatistics();
    await f.svc.flushStatistics();
    await connection.close();
    connection = await createDb({ path });
    storage = createDocumentStorageDBService(connection.db);
    await withOrderedOwner(connection.db, owner, async (journal) => {
      expect(JSON.stringify((await journal.canonical(["card"])).get("card"))).toBe(JSON.stringify(canonical));
    });
    const rootKey = retainedPageKey("tombstones", "");
    const page = await withOrderedOwner(connection.db, owner, async (_journal, tx) => {
      const page = await readOrderedMarker(tx, owner, rootKey);
      await saveOrderedMarker(tx, owner, rootKey, { broken: true });
      return page!.value;
    });
    await expect(
      open().commit({
        operationId: "damaged-restore",
        edits: [
          { recordId: "card", deleted: false },
          { recordId: "sibling", replace: true },
        ],
      }),
    ).rejects.toThrow("Invalid retained page");
    await withOrderedOwner(connection.db, owner, async (_journal, tx) => {
      await saveOrderedMarker(tx, owner, rootKey, page);
    });
    expect((await open().read("sibling")).exists).toBe(false);
    await open().commit({ operationId: "restore-native", edits: [{ recordId: "card", deleted: false }] });
    expect((await open().read("card")).value).toEqual({ description: "edited native 日本語" });
  } finally {
    await storage.flushStatistics();
    await connection.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("a failed SQL compaction rolls back private values and a later maintenance pass can compact", async () => {
  const f = await createExtensionStorageFixture();
  const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
  const storage = createDocumentStorageDBService(f.db);
  const store = storage.open({ owner }).records;
  try {
    await store.commit({ operationId: "seed-rollback", edits: [{ recordId: "card", replace: "x".repeat(30_000) }] });
    await store.commit({ operationId: "delete-rollback", edits: [{ recordId: "card", deleted: true }] });
    await f.db.execute(
      sql`CREATE FUNCTION reject_compaction() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'compaction interrupted'; END $$`,
    );
    await f.db.execute(
      sql`CREATE TRIGGER reject_compaction BEFORE UPDATE ON records FOR EACH ROW EXECUTE FUNCTION reject_compaction()`,
    );
    await expect(compactOrderedTombstones(f.db, owner)).rejects.toThrow();
    await withOrderedOwner(f.db, owner, async (_journal, tx) => {
      expect(await createRetainedPages(tx, owner, "tombstones").get("card")).toBeUndefined();
    });
    await f.db.execute(sql`DROP TRIGGER reject_compaction ON records`);
    expect(await compactOrderedTombstones(f.db, owner)).toBe(1);
    expect(await compactOrderedTombstones(f.db, owner)).toBe(0);
    await store.commit({ operationId: "restore-rollback", edits: [{ recordId: "card", deleted: false }] });
    expect((await store.read("card")).value).toBe("x".repeat(30_000));
  } finally {
    await storage.flushStatistics();
    await f.svc.flushStatistics();
    await f.close();
  }
});

test("discarding records retires private deleted values only for that owner", async () => {
  const f = await createExtensionStorageFixture();
  const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
  const other = { ...owner, extensionId: "example.other" };
  const storage = createDocumentStorageDBService(f.db);
  try {
    for (const address of [owner, other]) {
      const store = storage.open({ owner: address }).records;
      await store.commit({
        operationId: "seed-discard",
        edits: [{ recordId: "card", replace: { secret: address.extensionId } }],
      });
      await store.commit({ operationId: "delete-discard", edits: [{ recordId: "card", deleted: true }] });
      await compactOrderedTombstones(f.db, address);
    }
    await storage.documents.discard(owner, "records");
    expect((await storage.open({ owner }).records.read("card")).exists).toBe(false);
    await withOrderedOwner(f.db, owner, async (_journal, tx) => {
      expect(await createRetainedPages(tx, owner, "tombstones").get("card")).toBeUndefined();
      expect(await createRetainedPages(tx, other, "tombstones").get("card")).toBeDefined();
    });
    await storage
      .open({ owner: other })
      .records.commit({ operationId: "restore-other", edits: [{ recordId: "card", deleted: false }] });
    expect((await storage.open({ owner: other }).records.read("card")).value).toEqual({ secret: other.extensionId });
  } finally {
    await storage.flushStatistics();
    await f.svc.flushStatistics();
    await f.close();
  }
});
