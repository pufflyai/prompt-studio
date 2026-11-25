import { expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { records as rows } from "../../db/schemas.pg";
import { createExtensionUserDataDBService } from "../extension-user-data/extension-user-data";
import { compactOrderedTombstones } from "./compact-tombstones";
import { createOperationRetentionFixture } from "./operation-retention.fixture";
import { withOrderedOwner } from "./ordered-journal";
import { decodeOrderedJson, orderedOwnerWhere } from "./ordered-sql";
import { pruneSettledOperations } from "./prune-operations";
import { purgeOrderedTombstones } from "./purge-tombstones";
import { createRetainedPages } from "./retained-pages";

test("local tombstone SQL expires after thirty days while observations and old-value restore survive", async () => {
  const f = await createOperationRetentionFixture();
  const users = createExtensionUserDataDBService(f.db);
  const value = { z: "old日本語\0", a: { first: "\ud800", second: "\ud801" } };
  try {
    await f.records.commit({ operationId: "seed-purge", edits: [{ recordId: "card", replace: value }] });
    await f.records.commit({ operationId: "delete-purge", edits: [{ recordId: "card", deleted: true }] });
    expect(await f.service.hasData(f.owner)).toBe(true);
    expect(await users.hasUserData(f.instanceAId)).toBe(true);
    const before = await f.records.read("card");
    const canonical = await withOrderedOwner(f.db, f.owner, (journal) => journal.canonical(["card"]));
    await compactOrderedTombstones(f.db, f.owner);
    expect((await purgeOrderedTombstones(f.db, f.owner, new Date(Date.now() + 29 * 86_400_000))).removed).toBe(0);
    expect((await purgeOrderedTombstones(f.db, f.owner, new Date(Date.now() + 31 * 86_400_000))).removed).toBe(1);
    expect(
      await f.db
        .select()
        .from(rows)
        .where(and(orderedOwnerWhere(rows, f.owner), eq(rows.record_id, "card"))),
    ).toEqual([]);
    expect(await f.service.hasData(f.owner)).toBe(true);
    expect(await users.hasUserData(f.instanceAId)).toBe(true);
    expect(await users.hasUserData(f.instanceBId)).toBe(false);
    expect(await f.service.hasData({ ...f.owner, workbenchId: f.projectBId })).toBe(false);
    expect(await f.records.read("card")).toEqual(before);
    expect(await withOrderedOwner(f.db, f.owner, (journal) => journal.canonical(["card"]))).toEqual(canonical);
    await f.records.commit({
      operationId: "restore-purge",
      edits: [{ recordId: "card", expectedRevision: before.revision, deleted: false }],
    });
    expect((await f.records.read("card")).value).toEqual(value);
    await withOrderedOwner(f.db, f.owner, async (_journal, tx) => {
      expect(await createRetainedPages(tx, f.owner, "tombstones").get("card")).toBeUndefined();
    });
  } finally {
    await f.close();
  }
});

test("Cloud tombstones wait for published deletion coverage and can use a pruned receipt", async () => {
  const f = await createOperationRetentionFixture();
  try {
    await f.records.commit({ operationId: "seed-cloud-purge", edits: [{ recordId: "card", replace: "recover me" }] });
    await f.sync.synchronize();
    await f.records.commit({ operationId: "delete-cloud-purge", edits: [{ recordId: "card", deleted: true }] });
    const replace = f.relay.replace;
    f.relay.replace = async () => {
      throw new Error("hold deletion checkpoint");
    };
    await expect(f.sync.synchronize()).rejects.toThrow("hold deletion checkpoint");
    expect(await compactOrderedTombstones(f.db, f.owner)).toBe(1);
    expect((await purgeOrderedTombstones(f.db, f.owner, new Date(Date.now() + 100 * 86_400_000))).removed).toBe(0);
    f.relay.replace = replace;
    await f.sync.synchronize();
    await compactOrderedTombstones(f.db, f.owner);
    await pruneSettledOperations(f.db, f.owner, new Date(Date.now() + 8 * 86_400_000));
    expect((await purgeOrderedTombstones(f.db, f.owner)).removed).toBe(1);
    expect((await f.records.read("card")).deleted).toBe(true);
    await f.records.commit({ operationId: "restore-cloud-purge", edits: [{ recordId: "card", deleted: false }] });
    const [pending] = await f.db
      .select({ base: rows.base })
      .from(rows)
      .where(and(orderedOwnerWhere(rows, f.owner), eq(rows.record_id, "card")));
    expect(decodeOrderedJson<{ deleted: boolean }>(pending!.base!).deleted).toBe(true);
    await withOrderedOwner(f.db, f.owner, async (_journal, tx) => {
      expect(await createRetainedPages(tx, f.owner, "tombstones").get("card")).toBeUndefined();
    });
    await f.sync.synchronize();
    expect((await f.records.read("card")).value).toBe("recover me");
  } finally {
    await f.close();
  }
});
