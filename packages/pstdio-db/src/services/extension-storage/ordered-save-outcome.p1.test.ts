import { expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../../db/schemas.pg";
import { attachDocumentFiles, documentFilesFor } from "./document-files";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { withOrderedOwner } from "./ordered-journal";

test("save outcomes select their exact settlement epoch without loading pending record bodies", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const statements: string[] = [];
    const db = drizzle(f.db.$client, { schema, logger: { logQuery: (query) => statements.push(query) } });
    attachDocumentFiles(db, documentFilesFor(f.db));
    const owner = { workbenchId: f.projectAId, extensionId: "example.outcomes" };
    const service = createDocumentStorageDBService(db);
    const records = service.open({ owner }).records;
    await records.commit({ operationId: "seed", edits: [{ recordId: "card", replace: "confirmed" }] });
    expect(await records.outcome("seed")).toMatchObject({ state: "saved-locally" });
    await withOrderedOwner(db, owner, async (journal) => {
      const local = (await journal.unindexed())[0]!;
      await journal.recordDecision({ ...local.decision, epoch: "foreign", state: "refused" }, "foreign-admission");
      await journal.bindIdentity("receipt-only", "foreign-only");
    });
    expect(await records.outcome("seed")).toMatchObject({ state: "saved-locally" });
    expect(await records.outcome("receipt-only")).toBeUndefined();
    await withOrderedOwner(db, owner, async (journal) => {
      await journal.markIndexed(
        (await journal.unindexed()).filter((receipt) => receipt.decision.epoch.startsWith("local:")),
      );
    });
    expect(await records.outcome("seed")).toMatchObject({ state: "synced" });
    await db
      .update(schema.owners)
      .set({ joined: true, epoch: "cloud" })
      .where(and(eq(schema.owners.project_id, owner.workbenchId), eq(schema.owners.extension_id, owner.extensionId)));
    await records.commit({ operationId: "pending", edits: [{ recordId: "card", replace: "x".repeat(200_000) }] });
    statements.length = 0;
    expect(await records.outcome("pending")).toEqual({
      operationId: "pending",
      state: "saved-locally",
      status: "saved-locally",
    });
    // One statement observes identity and decision together, without materializing the
    // pending save's large authored values or taking a write lock for this read.
    expect(statements).toHaveLength(1);
    expect(statements[0]).not.toContain('"envelope"');
    expect(statements[0]).not.toContain("for update");
    await records.transaction(async (transaction) => {
      await transaction.commit({ operationId: "callback", edits: [{ recordId: "other", replace: "in transaction" }] });
      expect(await transaction.outcome("callback")).toMatchObject({ state: "saved-locally" });
      expect(await transaction.outcome("receipt-only")).toBeUndefined();
    });
    await expect(
      records.transaction(async (transaction) => {
        await transaction.commit({ operationId: "rolled-back", edits: [{ recordId: "other", replace: "discard" }] });
        expect(await transaction.outcome("rolled-back")).toMatchObject({ state: "saved-locally" });
        throw new Error("rollback callback");
      }),
    ).rejects.toThrow("rollback callback");
    expect(await records.outcome("rolled-back")).toBeUndefined();
    await service.flushStatistics();
  } finally {
    await f.close();
  }
});
