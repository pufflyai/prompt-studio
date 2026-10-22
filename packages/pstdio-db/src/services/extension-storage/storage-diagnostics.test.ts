import { expect, test } from "bun:test";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import type { StorageDiagnostic } from "./storage-diagnostics";

test("storage diagnostics distinguish source capture, hydration and durable checkpoint publication", async () => {
  const fixture = await createExtensionStorageFixture();
  const owner = { workbenchId: fixture.projectAId, extensionId: "diagnostics.example" };
  const events: StorageDiagnostic[] = [];
  const service = createDocumentStorageDBService(fixture.db, undefined, (event) => events.push(event));
  const storage = service.open({ owner });
  try {
    for (let index = 0; index < 128; index++)
      await storage.records.commit({
        operationId: `write-${index}`,
        edits: [{ recordId: "note", replace: { title: `Revision ${index}` } }],
      });
    await service.flushCheckpoints();
    const phases = events.filter((event) => event.phase !== "records-projected");
    expect(phases.map((event) => event.phase)).toEqual([
      "document-captured",
      "document-hydrated",
      "document-loaded",
      "checkpoint-captured",
      "checkpoint-compacted",
      "checkpoint-persisted",
    ]);
    for (const event of phases) {
      expect(event.owner).toEqual(owner);
      expect(event.bytes).toBeGreaterThan(0);
    }
    const restarted = createDocumentStorageDBService(fixture.db).open({ owner });
    expect((await restarted.records.read("note")).value).toEqual({ title: "Revision 127" });
  } finally {
    await service.flushCheckpoints();
    await fixture.close();
  }
});
