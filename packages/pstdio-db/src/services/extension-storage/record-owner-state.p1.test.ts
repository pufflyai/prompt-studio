import { expect, test } from "bun:test";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { createOrderedLogStore } from "./ordered-log-store";

test("logs and record counts coexist when either feature creates the owner first", async () => {
  const f = await createExtensionStorageFixture();
  try {
    for (const logFirst of [true, false]) {
      const owner = { workbenchId: f.projectAId, extensionId: `example.owner-${logFirst}` };
      const log = createOrderedLogStore(f.db, {
        owner,
        name: "events",
        scope: "project",
        stream: "writer",
        writerId: "writer",
      });
      if (logFirst) await log.append({ text: "Before records" });
      const records = (await f.svc.open({ owner })).records;
      await records.defineIndexes([
        {
          name: "things",
          fields: { state: { path: ["state"], type: "string", derive: { kind: "string" } } },
          countBy: ["state"],
        },
      ]);
      expect((await records.aggregate({ index: "things", groupBy: "state" })).count).toBe(0);
      await records.commit({ operationId: "save", edits: [{ recordId: "one", replace: { state: "open" } }] });
      const before = await records.query({ index: "things", limit: 10 });
      await log.append({ text: "After records" });
      const after = await records.query({ index: "things", limit: 10 });
      expect(after).toEqual(before);
      expect(after.records).toHaveLength(1);
      expect((await records.aggregate({ index: "things", groupBy: "state" })).count).toBe(1);
    }
  } finally {
    await f.close();
  }
});

test("discarding the records document invalidates old query cursors and warmed aggregate counts", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "example.discard-generation" };
    const service = createDocumentStorageDBService(f.db);
    const records = service.open({ owner }).records;
    await records.defineIndexes([
      {
        name: "things",
        fields: { state: { path: ["state"], type: "string", derive: { kind: "string" } } },
        countBy: ["state"],
      },
    ]);
    await records.commit({
      operationId: "old",
      edits: ["one", "two"].map((recordId) => ({ recordId, replace: { state: "open" } })),
    });
    const before = await records.query({ index: "things", limit: 1 });
    expect(before.cursor).not.toBeNull();
    expect((await records.aggregate({ index: "things", groupBy: "state" })).groups).toEqual([
      { value: "open", count: 2 },
    ]);
    await service.documents.discard(owner, "records");
    await records.commit({
      operationId: "new",
      edits: ["three", "four"].map((recordId) => ({ recordId, replace: { state: "closed" } })),
    });
    const after = await records.query({ index: "things", limit: 1 });
    expect(after.revision).not.toBe(before.revision);
    await expect(records.query({ index: "things", limit: 1, cursor: before.cursor! })).rejects.toThrow();
    expect((await records.aggregate({ index: "things", groupBy: "state" })).groups).toEqual([
      { value: "closed", count: 2 },
    ]);
  } finally {
    await f.close();
  }
});
