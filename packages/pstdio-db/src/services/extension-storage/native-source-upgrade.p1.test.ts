import { expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { storage_current_records } from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { upgradeNativeSourceLifetimes } from "./native-source-upgrade";
import { resourceDocumentId } from "./resource-document-persistence";

test("startup derives old record lifetimes without changing source data or creating native text", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "example.notes" };
    const storage = createDocumentStorageDBService(f.db);
    const records = storage.open({ owner }).records;
    await records.commit({ operationId: "create", edits: [{ recordId: "note", replace: { content: "kept" } }] });
    const original = await records.read("note");
    await f.db
      .update(storage_current_records)
      .set({ record_lifetime: "" })
      .where(eq(storage_current_records.record_id, "note"));
    await upgradeNativeSourceLifetimes(f.db, {
      failed: (error) => {
        throw error;
      },
    });
    expect(await records.read("note")).toEqual(original);
    await records.bindText({ recordId: "note", field: "/content", documentKey: "a".repeat(64) });
    expect(await storage.openNativeTextDocument({ owner, fileId: "a".repeat(64) }).read()).toBe("kept");
  } finally {
    await f.close();
  }
});

test("a damaged old record stays pending while startup derives healthy records", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "example.notes" };
    const service = createDocumentStorageDBService(f.db);
    const records = service.open({ owner }).records;
    await records.commit({
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
    expect((await records.read("bad")).value).toEqual({ content: "retained" });
    await expect(
      records.bindText({ recordId: "bad", field: "/content", documentKey: "b".repeat(64) }),
    ).rejects.toMatchObject({ code: "native_source_pending" });
    await records.bindText({ recordId: "good", field: "/content", documentKey: "c".repeat(64) });
    expect(await service.openNativeTextDocument({ owner, fileId: "c".repeat(64) }).read()).toBe("healthy");
  } finally {
    await f.close();
  }
});
