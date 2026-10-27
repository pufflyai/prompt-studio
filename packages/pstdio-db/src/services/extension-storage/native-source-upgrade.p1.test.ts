import { expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { storage_current_records } from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { upgradeNativeSourceLifetimes } from "./native-source-upgrade";

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
    await upgradeNativeSourceLifetimes(f.db);
    expect(await records.read("note")).toEqual(original);
    await records.bindText({ recordId: "note", field: "/content", documentKey: "a".repeat(64) });
    expect(await storage.openNativeTextDocument({ owner, fileId: "a".repeat(64) }).read()).toBe("kept");
  } finally {
    await f.close();
  }
});
