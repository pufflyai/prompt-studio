import { expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { operations } from "../../db/schemas.pg";
import { createOperationRetentionFixture } from "./operation-retention.fixture";
import { withOrderedOwner } from "./ordered-journal";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";
import { pruneSettledOperations } from "./prune-operations";

const read = async (
  f: Awaited<ReturnType<typeof createOperationRetentionFixture>>,
  id: string,
  client: Pick<OrderedTransaction, "select"> = f.db,
) =>
  (
    await client
      .select()
      .from(operations)
      .where(and(orderedOwnerWhere(operations, f.owner), eq(operations.operation_id, id)))
  )[0]!;

test("receipt coverage requires the exact decision and operation identity", async () => {
  const f = await createOperationRetentionFixture();
  const decision = { operationId: "foreign", fingerprint: "a".repeat(64), epoch: "remote", state: "accepted" as const };
  try {
    await withOrderedOwner(f.db, f.owner, async (journal) => {
      await journal.recordDecision(decision, "b".repeat(64));
      await journal.markIndexed([
        {
          decision: { ...decision, state: "refused", fingerprint: "c".repeat(64) },
          admissionFingerprint: "b".repeat(64),
        },
      ]);
    });
    expect((await read(f, decision.operationId)).indexed_at).toBeNull();
    expect(await pruneSettledOperations(f.db, f.owner, new Date(Date.now() + 8 * 86_400_000))).toBe(0);
  } finally {
    await f.close();
  }
});

test("new unindexed epoch facts clear the pruning clock and duplicate coverage preserves the original time", async () => {
  const f = await createOperationRetentionFixture();
  try {
    await f.records.commit({ operationId: "seed-clock", edits: [{ recordId: "card", replace: true }] });
    await f.sync.synchronize();
    const row = await read(f, "seed-clock");
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const receipts = Object.fromEntries(
      Object.entries(row.receipt).map(([epoch, receipt]) => [epoch, { ...receipt, indexedAt: past }]),
    );
    await f.db
      .update(operations)
      .set({ receipt: receipts, indexed_at: past })
      .where(and(orderedOwnerWhere(operations, f.owner), eq(operations.operation_id, "seed-clock")));
    await withOrderedOwner(f.db, f.owner, async (journal, tx) => {
      const original = (await journal.cachedReceipt("seed-clock", row.settled_epoch!))!;
      await journal.markIndexed([original]);
      expect((await read(f, "seed-clock", tx)).indexed_at).toBe(past);
      const later = {
        ...original,
        decision: { ...original.decision, epoch: "later-epoch" },
        admissionFingerprint: "d".repeat(64),
      };
      await journal.recordDecision(later.decision, later.admissionFingerprint);
      expect((await read(f, "seed-clock", tx)).indexed_at).toBeNull();
      await journal.markIndexed([original]);
      expect((await read(f, "seed-clock", tx)).indexed_at).toBeNull();
      await journal.markIndexed([later]);
      expect((await read(f, "seed-clock", tx)).indexed_at! > past).toBe(true);
    });
  } finally {
    await f.close();
  }
});

test("an unpublished checkpoint cannot start retention for receipts in its local index", async () => {
  const f = await createOperationRetentionFixture();
  try {
    await f.records.commit({ operationId: "before-root", edits: [{ recordId: "card", replace: true }] });
    await f.sync.synchronize();
    await f.records.commit({ operationId: "held-root", edits: [{ recordId: "card", replace: false }] });
    const replace = f.relay.replace;
    f.relay.replace = async () => {
      throw new Error("Checkpoint publication held");
    };
    await expect(f.sync.synchronize()).rejects.toThrow("Checkpoint publication held");
    expect((await read(f, "held-root")).indexed_at).toBeNull();
    expect((await read(f, "held-root")).envelope).toBeNull();
    expect(await pruneSettledOperations(f.db, f.owner, new Date(Date.now() + 8 * 86_400_000))).toBe(1);
    expect((await read(f, "held-root")).indexed_at).toBeNull();
    f.relay.replace = replace;
    await f.sync.synchronize();
    expect((await read(f, "held-root")).indexed_at).not.toBeNull();
    expect(await pruneSettledOperations(f.db, f.owner, new Date(Date.now() + 6 * 86_400_000))).toBe(0);
    expect(await pruneSettledOperations(f.db, f.owner, new Date(Date.now() + 8 * 86_400_000))).toBe(1);
  } finally {
    await f.close();
  }
});
