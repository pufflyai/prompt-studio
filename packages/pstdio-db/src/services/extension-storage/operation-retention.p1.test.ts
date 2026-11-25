import { expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { operations } from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { createOperationRetentionFixture } from "./operation-retention.fixture";
import { orderedOwnerWhere } from "./ordered-sql";
import { pruneSettledOperations } from "./prune-operations";

test("seven-day SQL receipt retention preserves authored outcomes, exact retries and dependencies offline", async () => {
  const f = await createOperationRetentionFixture();
  const seed = { operationId: "old-save", edits: [{ recordId: "card", replace: { title: "before retention" } }] };
  try {
    await f.records.commit(seed);
    await f.sync.synchronize();
    const before = await f.records.outcome(seed.operationId);
    expect(before?.state).toBe("synced");
    expect(await pruneSettledOperations(f.db, f.owner, new Date(Date.now() + 6 * 86_400_000))).toBe(0);
    expect(await pruneSettledOperations(f.db, f.owner, new Date(Date.now() + 8 * 86_400_000))).toBe(1);
    expect(
      await f.db
        .select({ id: operations.operation_id })
        .from(operations)
        .where(and(orderedOwnerWhere(operations, f.owner), eq(operations.operation_id, seed.operationId))),
    ).toEqual([]);
    const reopenedFacade = createDocumentStorageDBService(f.db);
    try {
      const records = reopenedFacade.open({ owner: f.owner }).records;
      expect(await records.outcome(seed.operationId)).toEqual(before);
      await records.commit({
        operationId: "after-retention",
        edits: [{ recordId: "card", set: { "/title": "after retention" } }],
      });
      expect(await records.commit(seed)).toEqual(before!);
      expect((await records.read("card")).value).toEqual({ title: "after retention" });
      await expect(records.commit({ ...seed, edits: [{ recordId: "card", replace: false }] })).rejects.toThrow(
        "identity",
      );
    } finally {
      await reopenedFacade.flushStatistics();
    }
  } finally {
    await f.close();
  }
});

test("never-joined local saves and joined pending saves do not expire without published receipts", async () => {
  const f = await createOperationRetentionFixture();
  try {
    await f.records.commit({ operationId: "local-only", edits: [{ recordId: "card", replace: true }] });
    expect(await pruneSettledOperations(f.db, f.owner, new Date(Date.now() + 100 * 86_400_000))).toBe(0);
    await f.sync.synchronize();
    await f.records.commit({ operationId: "pending-upload", edits: [{ recordId: "card", replace: false }] });
    expect(await pruneSettledOperations(f.db, f.owner, new Date(Date.now() + 8 * 86_400_000))).toBe(1);
    expect((await f.db.select().from(operations)).map((row) => row.operation_id)).toEqual(["pending-upload"]);
    expect(await f.records.outcome("local-only")).toMatchObject({ state: "synced" });
    expect(await f.records.outcome("pending-upload")).toMatchObject({ state: "saved-locally" });
  } finally {
    await f.close();
  }
});
