import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createDb } from "../../db/connection.pglite";
import { compactOrderedTombstones } from "./compact-tombstones";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { createOperationRetentionFixture } from "./operation-retention.fixture";
import { withOrderedOwner } from "./ordered-journal";
import { purgeOrderedTombstones } from "./purge-tombstones";
import { createRetainedPages } from "./retained-pages";
import type { RetainedRecord } from "./retained-records";

test("an owner with only SQL-purged local deletions still founds Cloud", async () => {
  const f = await createOperationRetentionFixture();
  try {
    await f.records.commit({
      operationId: "seed-first-join",
      edits: [{ recordId: "card", replace: "before joining" }],
    });
    await f.records.commit({ operationId: "delete-first-join", edits: [{ recordId: "card", deleted: true }] });
    await compactOrderedTombstones(f.db, f.owner);
    await purgeOrderedTombstones(f.db, f.owner, new Date(Date.now() + 31 * 86_400_000));
    const stream = f.service.documents.recordStream(f.owner);
    expect(await stream.hasRecords()).toBe(true);
    expect(await stream.pending()).toBe(true);
    await f.sync.synchronize();
    expect((await f.records.read("card")).deleted).toBe(true);
    expect(await stream.pending()).toBe(false);
    await f.records.commit({ operationId: "restore-first-join", edits: [{ recordId: "card", deleted: false }] });
    await f.sync.synchronize();
    expect((await f.records.read("card")).value).toBe("before joining");
  } finally {
    await f.close();
  }
});

test("adopting a same-epoch stale checkpoint repairs a SQL-purged accepted deletion", async () => {
  const f = await createOperationRetentionFixture();
  try {
    await f.records.commit({
      operationId: "seed-stale-checkpoint",
      edits: [{ recordId: "card", replace: "before deletion" }],
    });
    await f.sync.synchronize();
    const space = await createSyncSpace({
      projectId: f.owner.workbenchId,
      spaceOwner: null,
      keys: [{ generation: 1, secret: "A".repeat(43) }],
    });
    const stream = f.service.documents.recordStream(f.owner);
    await stream.connect!(space, f.relay);
    const before = await stream.snapshot({ found: false });
    await f.records.commit({ operationId: "delete-stale-checkpoint", edits: [{ recordId: "card", deleted: true }] });
    await f.sync.synchronize();
    await compactOrderedTombstones(f.db, f.owner);
    expect((await purgeOrderedTombstones(f.db, f.owner)).removed).toBe(1);
    await stream.merge(new Map(before.records.map((record) => [record.recordId, [record.bytes]])), "adopt", {
      ...(await stream.open()),
      stateId: "stale-checkpoint",
      receiptRoot: before.receiptRoot,
    });
    expect((await f.records.read("card")).deleted).toBe(true);
    await f.records.commit({ operationId: "restore-after-stale", edits: [{ recordId: "card", deleted: false }] });
    expect((await f.records.read("card")).value).toBe("before deletion");
  } finally {
    await f.close();
  }
});

test("a SQL-purged native deleted value restores after a disk restart without Cloud", async () => {
  const root = await mkdtemp(join(tmpdir(), "purged-native-"));
  const path = join(root, "database");
  const f = await createOperationRetentionFixture(path);
  const owner = f.owner;
  let firstClosed = false;
  try {
    const records = f.service.open({ owner, textFields: [{ prefix: "card", fields: ["/description"] }] }).records;
    const key = "a".repeat(64);
    await records.commit({
      operationId: "seed-native-purge",
      edits: [{ recordId: "card", replace: { description: "old text" } }],
    });
    await records.bindText({ recordId: "card", field: "/description", documentKey: key });
    await f.service.openNativeTextDocument({ owner, fileId: key }).save("edited 日本語 before deletion");
    await records.commit({ operationId: "delete-native-purge", edits: [{ recordId: "card", deleted: true }] });
    const before = await records.read("card");
    await compactOrderedTombstones(f.db, owner);
    expect((await purgeOrderedTombstones(f.db, owner, new Date(Date.now() + 31 * 86_400_000))).removed).toBe(1);
    await f.close();
    firstClosed = true;
    const connection = await createDb({ path });
    const service = createDocumentStorageDBService(connection.db);
    try {
      const reopened = service.open({ owner, textFields: [{ prefix: "card", fields: ["/description"] }] }).records;
      expect(await reopened.read("card")).toEqual(before);
      await reopened.commit({ operationId: "restore-native-purge", edits: [{ recordId: "card", deleted: false }] });
      expect((await reopened.read("card")).value).toEqual({ description: "edited 日本語 before deletion" });
    } finally {
      await service.flushStatistics();
      await connection.close();
    }
  } finally {
    if (!firstClosed) await f.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("a founding checkpoint carries SQL-purged deletion authority into another database", async () => {
  const f = await createOperationRetentionFixture();
  const target = await createExtensionStorageFixture();
  const service = createDocumentStorageDBService(target.db);
  const value = { z: "cold checkpoint", a: "\ud800" };
  try {
    await f.records.commit({ operationId: "seed-cold-checkpoint", edits: [{ recordId: "card", replace: value }] });
    await f.records.commit({ operationId: "delete-cold-checkpoint", edits: [{ recordId: "card", deleted: true }] });
    await compactOrderedTombstones(f.db, f.owner);
    await purgeOrderedTombstones(f.db, f.owner, new Date(Date.now() + 31 * 86_400_000));
    const space = await createSyncSpace({
      projectId: f.owner.workbenchId,
      spaceOwner: null,
      keys: [{ generation: 1, secret: "A".repeat(43) }],
    });
    const source = f.service.documents.recordStream(f.owner);
    await source.connect!(space, f.relay);
    const snapshot = await source.snapshot({ found: true, relayEmpty: true });
    const owner = { workbenchId: target.projectAId, extensionId: f.owner.extensionId };
    const store = service.documents.recordStream(owner);
    await store.connect!(space, f.relay);
    await store.merge(new Map(snapshot.records.map((record) => [record.recordId, [record.bytes]])), "adopt", {
      joined: true,
      after: 0,
      stateId: "cold-checkpoint",
      through: 0,
      pendingBytes: 0,
      stateBytes: 1,
      skipped: false,
    });
    const records = service.open({ owner }).records;
    expect((await records.read("card")).deleted).toBe(true);
    await records.commit({ operationId: "restore-cold-checkpoint", edits: [{ recordId: "card", deleted: false }] });
    expect((await records.read("card")).value).toEqual(value);
  } finally {
    await service.flushStatistics();
    await target.svc.flushStatistics();
    await target.close();
    await f.close();
  }
});

test("purge rollback and damaged cold authority never fabricate absence or partially restore a group", async () => {
  const f = await createOperationRetentionFixture();
  try {
    await f.records.commit({ operationId: "seed-atomic-purge", edits: [{ recordId: "card", replace: "old value" }] });
    await f.records.commit({ operationId: "delete-atomic-purge", edits: [{ recordId: "card", deleted: true }] });
    const before = await f.records.read("card");
    await compactOrderedTombstones(f.db, f.owner);
    await f.db.execute(
      sql`CREATE FUNCTION reject_purge() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'purge interrupted'; END $$`,
    );
    await f.db.execute(
      sql`CREATE TRIGGER reject_purge BEFORE DELETE ON records FOR EACH ROW EXECUTE FUNCTION reject_purge()`,
    );
    await expect(purgeOrderedTombstones(f.db, f.owner, new Date(Date.now() + 31 * 86_400_000))).rejects.toThrow();
    expect(await f.records.read("card")).toEqual(before);
    await f.db.execute(sql`DROP TRIGGER reject_purge ON records`);
    expect((await purgeOrderedTombstones(f.db, f.owner, new Date(Date.now() + 31 * 86_400_000))).removed).toBe(1);
    const saved = await withOrderedOwner(f.db, f.owner, async (_journal, tx) => {
      const pages = createRetainedPages<RetainedRecord>(tx, f.owner, "tombstones");
      const saved = await pages.get("card");
      await pages.set([{ key: "card", value: false as unknown as RetainedRecord }]);
      return saved!;
    });
    await expect(f.records.read("card")).rejects.toThrow();
    await expect(
      f.records.commit({
        operationId: "bad-cold-group",
        edits: [
          { recordId: "card", deleted: false },
          { recordId: "sibling", replace: true },
        ],
      }),
    ).rejects.toThrow();
    await withOrderedOwner(f.db, f.owner, async (_journal, tx) => {
      await createRetainedPages<RetainedRecord>(tx, f.owner, "tombstones").set([{ key: "card", value: saved }]);
    });
    expect((await f.records.read("sibling")).exists).toBe(false);
    await expect(
      f.records.commit({
        operationId: "stale-cold-revision",
        edits: [{ recordId: "card", expectedRevision: "stale", deleted: false }],
      }),
    ).rejects.toThrow();
    expect(await f.records.read("card")).toEqual(before);
    await f.records.commit({
      operationId: "retry-cold-restore",
      edits: [{ recordId: "card", expectedRevision: before.revision, deleted: false }],
    });
    expect((await f.records.read("card")).value).toBe("old value");
  } finally {
    await f.close();
  }
});
