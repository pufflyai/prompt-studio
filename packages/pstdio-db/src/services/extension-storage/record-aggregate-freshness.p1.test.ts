import { expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import type { StorageRecordIndex } from "pstdio-sync-contracts";
import { storage_ordered_owners as owners } from "../../db/schemas.pg";
import { createProjectsDBService } from "../projects/projects";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

test("aggregate snapshots isolate callers and owners and follow record and index changes", async () => {
  const fixture = await createExtensionStorageFixture();
  try {
    const documents = createDocumentStorageDBService(fixture.db);
    const owner = { workbenchId: fixture.projectAId, extensionId: "aggregate.example" };
    const rows = documents.open({ owner }).records;
    const index: StorageRecordIndex = {
      name: "categories",
      fields: { category: { path: ["category"], type: "string" } },
    };
    await rows.defineIndexes([index]);
    await rows.commit({
      operationId: "seed",
      edits: [
        { recordId: "a", replace: { category: "first", alternate: "other-first" } },
        { recordId: "b", replace: { category: "second", alternate: "other-second" } },
      ],
    });
    const selection = { index: index.name, groupBy: "category" };
    const initial = await rows.aggregate(selection);
    for (const group of initial.groups) group.count = 500;
    const repeated = await rows.aggregate(selection);
    expect(repeated.count).toBe(2);
    expect(repeated.groups.map(({ count }) => count)).toEqual([1, 1]);
    expect((await rows.aggregate({ ...selection, where: { field: "category", op: "eq", value: "first" } })).count).toBe(
      1,
    );
    const other = documents.open({ owner: { ...owner, extensionId: "another.aggregate" } }).records;
    await other.defineIndexes([index]);
    expect((await other.aggregate(selection)).count).toBe(0);
    await rows.commit({ operationId: "move", edits: [{ recordId: "b", set: { "/category": "first" } }] });
    expect((await rows.aggregate(selection)).groups).toEqual([{ value: "first", count: 2 }]);
    await rows.defineIndexes([{ ...index, fields: { category: { path: ["alternate"], type: "string" } } }]);
    expect((await rows.aggregate(selection)).groups.map(({ value }) => value)).toEqual(["other-first", "other-second"]);
    expect((await other.aggregate(selection)).count).toBe(0);
  } finally {
    await fixture.close();
  }
});

test.each(["local", "Cloud"])("aggregate snapshots do not survive %s project deletion and recreation", async (mode) => {
  const fixture = await createExtensionStorageFixture();
  try {
    const projects = createProjectsDBService(fixture.db);
    const owner = { workbenchId: fixture.projectAId, extensionId: "aggregate.recreated" };
    const index: StorageRecordIndex = { name: "items", fields: { category: { path: ["category"], type: "string" } } };
    const selection = { index: index.name, where: { field: "category" as const, op: "eq" as const, value: "old" } };
    const original = createDocumentStorageDBService(fixture.db).open({ owner }).records;
    await original.defineIndexes([index]);
    await original.commit({ operationId: "original", edits: [{ recordId: "item", replace: { category: "old" } }] });
    if (mode === "Cloud")
      await fixture.db
        .update(owners)
        .set({ epoch: "same-cloud-checkpoint", joined: true })
        .where(eq(owners.workbench_id, owner.workbenchId));
    expect((await original.aggregate(selection)).count).toBe(1);
    await projects.hardDelete(fixture.projectAId);
    await projects.create({ id: fixture.projectAId, name: "Recreated" });
    const replacement = createDocumentStorageDBService(fixture.db).open({ owner }).records;
    await replacement.defineIndexes([index]);
    await replacement.commit({
      operationId: "replacement",
      edits: [{ recordId: "item", replace: { category: "new" } }],
    });
    if (mode === "Cloud")
      await fixture.db
        .update(owners)
        .set({ epoch: "same-cloud-checkpoint", joined: true })
        .where(eq(owners.workbench_id, owner.workbenchId));
    expect((await replacement.aggregate(selection)).count).toBe(0);
  } finally {
    await fixture.close();
  }
});
