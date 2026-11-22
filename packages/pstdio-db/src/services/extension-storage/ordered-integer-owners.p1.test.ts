import { expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { prepareOrderedOperation } from "pstdio-sync/records";
import { projects } from "../../db/schemas.pg";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { withOrderedOwner } from "./ordered-journal";
import { createOrderedLogStore } from "./ordered-log-store";

test("ordered records, pending groups and receipts use the same integer owner and forget recreated projects", async () => {
  const fixture = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: fixture.projectAId, extensionId: "example.records" };
    const others = [
      { ...owner, workbenchId: fixture.projectBId },
      { ...owner, extensionId: "example.other" },
    ];
    await createOrderedLogStore(fixture.db, {
      owner,
      name: "activity",
      scope: "project",
      stream: "laptop",
      writerId: "laptop",
    }).append({ text: "A log owner exists before records initialize" });
    const input = await prepareOrderedOperation(
      {
        operationId: "same-operation",
        edits: [{ recordId: "same-record", replace: { title: "Pending" } }],
      },
      new Map(),
    );
    for (const current of [owner, ...others])
      await withOrderedOwner(fixture.db, current, async (journal) => {
        const saved = await journal.queue(input, "retained-request");
        expect(await journal.queue(input, "retained-request")).toEqual(saved);
        await journal.saveCanonical([
          {
            recordId: "same-record",
            value: { title: current.extensionId },
            deleted: false,
            lifetime: "initial",
            stamps: {},
          },
        ]);
        await journal.recordDecision(
          {
            operationId: input.operationId,
            fingerprint: input.fingerprint,
            epoch: "earlier",
            state: "accepted",
          },
          "retained-admission",
        );
      });
    const keys = await fixture.db.execute<{ id: number }>(sql`
      SELECT owners.id FROM owners
      JOIN storage_ordered_owners s ON s.owner_id=owners.id
      JOIN storage_ordered_records r ON r.owner_id=s.owner_id
      JOIN storage_ordered_operations o ON o.owner_id=s.owner_id
      JOIN storage_ordered_touches t ON t.owner_id=o.owner_id AND t.operation_id=o.operation_id
      JOIN storage_ordered_receipts c ON c.owner_id=o.owner_id AND c.operation_id=o.operation_id
      ORDER BY owners.id`);
    expect(keys.rows).toHaveLength(3);
    expect(new Set(keys.rows.map((row) => row.id)).size).toBe(3);
    for (const current of [owner, ...others])
      await withOrderedOwner(fixture.db, current, async (journal) => {
        expect(await journal.pendingFor(["same-record"])).toHaveLength(1);
        expect((await journal.canonical(["same-record"])).get("same-record")?.value).toEqual({
          title: current.extensionId,
        });
        expect(await journal.cachedDecision("same-operation", "earlier")).toMatchObject({ state: "accepted" });
      });
    await fixture.db.delete(projects).where(eq(projects.id, fixture.projectAId));
    const stamp = new Date().toISOString();
    await fixture.db.insert(projects).values({
      id: fixture.projectAId,
      name: "Recreated",
      shorthand: "A",
      created_at: stamp,
      updated_at: stamp,
    });
    await withOrderedOwner(fixture.db, owner, async (journal) => {
      expect(await journal.pending()).toEqual([]);
      expect(await journal.canonical(["same-record"])).toEqual(new Map());
      expect(await journal.cachedDecision("same-operation", "earlier")).toBeUndefined();
      expect((await journal.queue(input, "new-request")).operation).toEqual(input);
    });
    await withOrderedOwner(fixture.db, others[0]!, async (journal) => {
      expect(await journal.pendingFor(["same-record"])).toHaveLength(1);
    });
  } finally {
    await fixture.close();
  }
});
