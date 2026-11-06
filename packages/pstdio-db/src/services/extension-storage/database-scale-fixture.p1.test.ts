import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { createDb } from "../../db/connection.pglite";
import { storage_ordered_operations, storage_ordered_receipts } from "../../db/schemas.pg";
import { prepareDatabaseFixture, verifyDatabaseFixture } from "./database-scale-fixture";

test("owner fixture verification survives reopen and rejects missing history or source", async () => {
  const root = await mkdtemp(join(tmpdir(), "owner-fixture-"));
  let reopened: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    const expected = { records: 101, seedCommits: 4 };
    expect(await prepareDatabaseFixture("small", 101, root, false, () => {})).toEqual(expected);
    reopened = await createDb({ path: join(root, "database") });
    expect(await verifyDatabaseFixture(reopened.db, "small", 101, false)).toEqual(expected);
    const [receipt] = await reopened.db.select().from(storage_ordered_operations);
    await reopened.db
      .update(storage_ordered_operations)
      .set({ request_fingerprint: "incorrect" })
      .where(eq(storage_ordered_operations.operation_id, receipt.operation_id));
    await expect(verifyDatabaseFixture(reopened.db, "small", 101, false)).rejects.toThrow("history receipt");
    await reopened.db
      .update(storage_ordered_operations)
      .set({ request_fingerprint: receipt.request_fingerprint })
      .where(eq(storage_ordered_operations.operation_id, receipt.operation_id));
    await reopened.db
      .delete(storage_ordered_receipts)
      .where(eq(storage_ordered_receipts.operation_id, receipt.operation_id));
    await expect(verifyDatabaseFixture(reopened.db, "small", 101, false)).rejects.toThrow();
  } finally {
    await reopened?.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("owner fixture preparation retains distinct churn records and all nine histories", async () => {
  const root = await mkdtemp(join(tmpdir(), "owner-churn-fixture-"));
  try {
    expect(await prepareDatabaseFixture("small", 2, root, true, () => {})).toEqual({ records: 2, seedCommits: 9 });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
