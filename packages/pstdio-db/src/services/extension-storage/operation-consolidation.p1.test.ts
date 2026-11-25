import { expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { projects } from "../../db/schemas.pg";
import { withOrderedOwner } from "./ordered-journal";

test("one operation row retains immutable decisions and indexing independently across epochs", async () => {
  const connection = await createDb({ path: ":memory:" });
  const owner = { workbenchId: "operation-consolidation", extensionId: "example.records" };
  const fingerprint = "f".repeat(64);
  const first = {
    decision: { epoch: "epoch-1", operationId: "same-save", fingerprint, state: "accepted" as const },
    admissionFingerprint: "a".repeat(64),
  };
  const second = {
    decision: { epoch: "epoch-2", operationId: "same-save", fingerprint, state: "refused" as const },
    admissionFingerprint: "b".repeat(64),
  };
  try {
    const now = new Date().toISOString();
    await connection.db.insert(projects).values({
      id: owner.workbenchId,
      name: "Operations",
      shorthand: "OP",
      created_at: now,
      updated_at: now,
    });
    await withOrderedOwner(connection.db, owner, async (journal) => {
      await journal.recordDecision(first.decision, first.admissionFingerprint);
      await journal.recordDecision(second.decision, second.admissionFingerprint);
      expect(await journal.cachedReceipt("same-save", "epoch-1")).toEqual(first);
      expect(await journal.cachedReceipt("same-save", "epoch-2")).toEqual(second);
      expect(await journal.unindexed()).toEqual([first, second]);
      expect(await journal.knownDependency("same-save")).toEqual(second.decision);
      await journal.markIndexed([first]);
      expect(await journal.isIndexed("same-save", "epoch-1")).toBe(true);
      expect(await journal.isIndexed("same-save", "epoch-2")).toBe(false);
      expect(await journal.unindexed()).toEqual([second]);
      await journal.markIndexed([{ ...second, admissionFingerprint: "c".repeat(64) }]);
      expect(await journal.unindexed()).toEqual([second]);
    });
    await expect(
      withOrderedOwner(connection.db, owner, (journal) =>
        journal.recordDecision({ ...first.decision, state: "refused" }, first.admissionFingerprint),
      ),
    ).rejects.toThrow("immutable");
    await expect(
      withOrderedOwner(connection.db, owner, (journal) => journal.bindIdentity("same-save", "d".repeat(64))),
    ).rejects.toThrow("identity");
    await withOrderedOwner(connection.db, owner, async (journal) => {
      expect(await journal.cachedReceipt("same-save", "epoch-1")).toEqual(first);
      expect(await journal.cachedReceipt("same-save", "epoch-2")).toEqual(second);
      expect(await journal.unindexed({ after: { epoch: "epoch-2", operationId: "same-save" } })).toEqual([]);
    });
    await withOrderedOwner(connection.db, { ...owner, extensionId: "example.other" }, async (journal) => {
      expect(await journal.cachedReceipt("same-save", "epoch-1")).toBeUndefined();
      expect(await journal.unindexed()).toEqual([]);
    });
    expect(
      (
        await connection.pglite.query(`SELECT
      to_regclass('public.operations')::text AS operations,
      to_regclass('public.storage_ordered_operations')::text AS previous,
      to_regclass('public.storage_ordered_touches')::text AS touches,
      to_regclass('public.storage_ordered_receipts')::text AS receipts`)
      ).rows,
    ).toEqual([{ operations: "operations", previous: null, touches: null, receipts: null }]);
  } finally {
    await connection.close();
  }
});

test("receipt pages seek by operation and retain every epoch when a cursor exhausts its operation", async () => {
  const connection = await createDb({ path: ":memory:" });
  const owner = { workbenchId: "receipt-pages", extensionId: "example.records" };
  try {
    const now = new Date().toISOString();
    await connection.db
      .insert(projects)
      .values({ id: owner.workbenchId, name: "Pages", shorthand: "RP", created_at: now, updated_at: now });
    await withOrderedOwner(connection.db, owner, async (journal) => {
      for (const operationId of ["z", "a", "m"])
        for (const epoch of ["b", "a"])
          await journal.recordDecision(
            { operationId, epoch, fingerprint: operationId, state: "accepted" },
            `${operationId}:${epoch}`,
          );
      let after: { operationId: string; epoch: string } | undefined;
      const found: string[] = [];
      for (let page = 0; page < 7; page++) {
        const rows = await journal.unindexed({ after, limit: 1 });
        if (!rows.length) break;
        const receipt = rows[0]!;
        after = receipt.decision;
        found.push(`${after.operationId}:${after.epoch}`);
        await journal.markIndexed([receipt]);
      }
      expect(found).toEqual(["a:a", "a:b", "m:a", "m:b", "z:a", "z:b"]);
      expect(await journal.unindexed()).toEqual([]);
    });
  } finally {
    await connection.close();
  }
});
