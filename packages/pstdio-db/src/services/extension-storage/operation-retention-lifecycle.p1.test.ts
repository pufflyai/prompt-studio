import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { createDb } from "../../db/connection.pglite";
import { operations, owners, projects, records as recordRows } from "../../db/schemas.pg";
import { captureDocumentFiles, restoreDocumentBackup } from "./document-history.fixture";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { createOperationRetentionFixture } from "./operation-retention.fixture";
import { withOrderedOwner } from "./ordered-journal";
import { orderedOwnerWhere } from "./ordered-sql";
import { pruneSettledOperations } from "./prune-operations";
import { createRetainedPages } from "./retained-pages";
import { ensureStorageOwner } from "./storage-owner-key";

test("pruned authored outcomes and exact retries survive a disk restart without reconnecting to Cloud", async () => {
  const root = await mkdtemp(join(tmpdir(), "operation-retention-"));
  const path = join(root, "database");
  const f = await createOperationRetentionFixture(path);
  const seed = { operationId: "disk-save", edits: [{ recordId: "card", replace: { z: "日本語\0", a: "\ud800" } }] };
  try {
    await f.records.commit(seed);
    await f.sync.synchronize();
    expect(await pruneSettledOperations(f.db, f.owner, new Date(Date.now() + 8 * 86_400_000))).toBe(1);
  } finally {
    await f.close();
  }
  const connection = await createDb({ path });
  const service = createDocumentStorageDBService(connection.db);
  try {
    const records = service.open({ owner: f.owner }).records;
    expect(await records.outcome(seed.operationId)).toMatchObject({ state: "synced" });
    expect(await records.commit(seed)).toMatchObject({ state: "synced" });
    expect((await records.read("card")).value).toEqual(seed.edits[0]!.replace);
    await expect(records.commit({ ...seed, edits: [{ recordId: "card", replace: null }] })).rejects.toThrow("identity");
  } finally {
    await service.flushStatistics();
    await connection.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("malformed retained authorship rejects outcomes and changed retries without publishing a replacement", async () => {
  const f = await createOperationRetentionFixture();
  const seed = { operationId: "damaged-save", edits: [{ recordId: "card", replace: "original" }] };
  try {
    await f.records.commit(seed);
    await f.sync.synchronize();
    expect(await pruneSettledOperations(f.db, f.owner, new Date(Date.now() + 8 * 86_400_000))).toBe(1);
    for (const value of [false, null, 0, "", {}]) {
      await withOrderedOwner(f.db, f.owner, async (_journal, tx) => {
        await createRetainedPages<unknown>(tx, f.owner, "authorship").set([{ key: seed.operationId, value }]);
      });
      await expect(f.records.outcome(seed.operationId)).rejects.toThrow("Invalid retained operation");
      await expect(
        f.records.commit({ ...seed, edits: [{ recordId: "card", replace: "replacement" }] }),
      ).rejects.toThrow("Invalid retained operation");
      expect((await f.records.read("card")).value).toBe("original");
      expect(await f.db.select().from(operations)).toHaveLength(0);
    }
  } finally {
    await f.close();
  }
});

test("failed operation pruning rolls back private authorship and foreign receipts never claim a local outcome", async () => {
  const f = await createOperationRetentionFixture();
  try {
    await f.records.commit({ operationId: "rollback-save", edits: [{ recordId: "card", replace: true }] });
    await f.sync.synchronize();
    await f.db.execute(
      sql`CREATE FUNCTION reject_pruning() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'pruning interrupted'; END $$`,
    );
    await f.db.execute(
      sql`CREATE TRIGGER reject_pruning BEFORE DELETE ON operations FOR EACH ROW EXECUTE FUNCTION reject_pruning()`,
    );
    await expect(pruneSettledOperations(f.db, f.owner, new Date(Date.now() + 8 * 86_400_000))).rejects.toThrow();
    await withOrderedOwner(f.db, f.owner, async (_journal, tx) => {
      expect(await createRetainedPages(tx, f.owner, "authorship").get("rollback-save")).toBeUndefined();
    });
    expect(await f.records.outcome("rollback-save")).toMatchObject({ state: "synced" });
    await f.db.execute(sql`DROP TRIGGER reject_pruning ON operations`);
    await withOrderedOwner(f.db, f.owner, async (journal) => {
      const decision = {
        epoch: "foreign-epoch",
        operationId: "foreign-save",
        fingerprint: "f".repeat(64),
        state: "refused" as const,
      };
      await journal.recordDecision(decision, "e".repeat(64), { indexed: true });
    });
    expect(await pruneSettledOperations(f.db, f.owner, new Date(Date.now() + 8 * 86_400_000))).toBe(2);
    expect(await f.records.outcome("foreign-save")).toBeUndefined();
    await withOrderedOwner(f.db, f.owner, async (journal) => {
      expect(await journal.requestIdentity("foreign-save")).toBeUndefined();
      expect(await journal.cachedDecision("foreign-save", "foreign-epoch")).toMatchObject({ state: "refused" });
    });
  } finally {
    await f.close();
  }
});

test("a restored document backup resolves pruned authorship against its remapped SQL owner", async () => {
  const f = await createOperationRetentionFixture();
  const target = await createExtensionStorageFixture();
  const storage = createDocumentStorageDBService(target.db);
  const seed = { operationId: "backup-save", edits: [{ recordId: "card", replace: "backed up" }] };
  try {
    await f.records.commit(seed);
    await f.sync.synchronize();
    await pruneSettledOperations(f.db, f.owner, new Date(Date.now() + 8 * 86_400_000));
    const backup = await captureDocumentFiles(f.db);
    const [source] = await f.db.select().from(owners).where(orderedOwnerWhere(owners, f.owner));
    const [project] = await f.db.select().from(projects).where(sql`${projects.id}=${f.owner.workbenchId}`);
    await target.db.insert(projects).values(project!);
    await ensureStorageOwner(target.db, { ...f.owner, extensionId: "example.offset" });
    const { id: oldId, ...owner } = source!;
    const [restored] = await target.db.insert(owners).values(owner).returning({ id: owners.id });
    expect(restored!.id).not.toBe(oldId);
    for (const row of await f.db.select().from(recordRows).where(orderedOwnerWhere(recordRows, f.owner)))
      await target.db.insert(recordRows).values({ ...row, owner_id: restored!.id });
    await restoreDocumentBackup(target.db, backup, new Map([[oldId, restored!.id]]));
    const records = storage.open({ owner: f.owner }).records;
    expect(await records.outcome(seed.operationId)).toMatchObject({ state: "synced" });
    expect(await records.commit(seed)).toMatchObject({ state: "synced" });
    expect((await records.read("card")).value).toBe("backed up");
    await withOrderedOwner(target.db, f.owner, async (journal) => {
      const saved = await journal.cachedDecision(seed.operationId, source!.epoch!);
      // The author's selected epoch may precede the founding epoch; dependency lookup retains it.
      const selected = saved ?? (await journal.knownDependency(seed.operationId));
      expect(selected).toBeDefined();
      await journal.bindIdentity(seed.operationId, selected!.fingerprint);
    });
    expect((await target.db.select().from(operations))[0]!.owner_id).toBe(restored!.id);
  } finally {
    await storage.flushStatistics();
    await target.svc.flushStatistics();
    await target.close();
    await f.close();
  }
});
