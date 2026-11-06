import { expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { storage_current_records } from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { upgradeNativeSourceLifetimes } from "./native-source-upgrade";
import { createProjectionStatistics } from "./projection-statistics";
import { resourceDocumentId } from "./resource-document-persistence";
import { createResourceRecords } from "./resource-records";

// The upgrade reads records saved before ordered storage, so seed them with the legacy writer.
const legacyRecords = (
  f: Awaited<ReturnType<typeof createExtensionStorageFixture>>,
  owner: { workbenchId: string; extensionId: string },
) => createResourceRecords(f.db, owner, { statistics: createProjectionStatistics(f.db), changed: () => {} });

test("startup derives old record lifetimes without changing source data or creating native text", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "example.notes" };
    await legacyRecords(f, owner).commit({
      operationId: "create",
      edits: [{ recordId: "note", replace: { content: "kept" } }],
    });
    const storage = createDocumentStorageDBService(f.db);
    const records = storage.open({ owner }).records;
    const original = await legacyRecords(f, owner).read("note");
    await f.db
      .update(storage_current_records)
      .set({ record_lifetime: "" })
      .where(eq(storage_current_records.record_id, "note"));
    await upgradeNativeSourceLifetimes(f.db, {
      failed: (error) => {
        throw error;
      },
    });
    expect(await legacyRecords(f, owner).read("note")).toEqual(original);
    await records.bindText({ recordId: "note", field: "/content", documentKey: "a".repeat(64) });
    expect(await storage.openNativeTextDocument({ owner, fileId: "a".repeat(64) }).read()).toBe("kept");
  } finally {
    await f.close();
  }
});

test("a damaged old record is reported while startup derives healthy records", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "example.notes" };
    await legacyRecords(f, owner).commit({
      operationId: "create",
      edits: [
        { recordId: "bad", replace: { content: "retained" } },
        { recordId: "good", replace: { content: "healthy" } },
      ],
    });
    await f.db.update(storage_current_records).set({ record_lifetime: "" });
    await f.db.execute(sql`DELETE FROM storage_documents WHERE document_id = ${resourceDocumentId("bad")}`);
    const failures: string[] = [];
    await upgradeNativeSourceLifetimes(f.db, { failed: (_error, row) => failures.push(row?.recordId ?? "batch") });
    expect(failures).toEqual(["bad"]);
    const service = createDocumentStorageDBService(f.db);
    const records = service.open({ owner }).records;
    expect((await records.read("bad")).value).toEqual({ content: "retained" });
    // Ordered conversion keeps plain legacy values without their Yjs history, so the damaged
    // record no longer blocks binding once its owner is opened.
    await records.bindText({ recordId: "bad", field: "/content", documentKey: "b".repeat(64) });
    expect(await service.openNativeTextDocument({ owner, fileId: "b".repeat(64) }).read()).toBe("retained");
    await records.bindText({ recordId: "good", field: "/content", documentKey: "c".repeat(64) });
    expect(await service.openNativeTextDocument({ owner, fileId: "c".repeat(64) }).read()).toBe("healthy");
  } finally {
    await f.close();
  }
});
