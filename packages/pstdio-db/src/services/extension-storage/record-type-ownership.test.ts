import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { storage_current_records, storage_record_projections, storage_record_types } from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

test("large ID-less nested items preserve original type ownership through save and backfill", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "large-nested-types" };
    const body = Array.from({ length: 512 }, (_, i) => createHash("sha256").update(String(i)).digest("hex")).join("");
    const value = { items: [{ body }] };
    const service = createDocumentStorageDBService(f.db);
    const storage = service.open({ owner });
    await storage.records.commit({ operationId: "save", edits: [{ recordId: "note", replace: value }] });
    const original = await storage.exportUpdate();
    const types = await f.db.select().from(storage_record_types);
    expect(types.some((type) => type.type_name.length > 16_384)).toBe(true);
    expect((await storage.records.readMany(["note"]))[0].value).toEqual(value);
    await f.db.delete(storage_record_types);
    await f.db.delete(storage_current_records);
    await f.db.delete(storage_record_projections);
    const reopened = createDocumentStorageDBService(f.db).open({ owner });
    await reopened.records.defineIndexes([]);
    expect((await reopened.records.readMany(["note"]))[0].value).toEqual(value);
    expect(await reopened.exportUpdate()).toEqual(original);
    expect(await f.db.select().from(storage_record_types)).toHaveLength(types.length);
    await reopened.records.commit({ operationId: "same", edits: [{ recordId: "note", replace: value }] });
    expect(await f.db.select().from(storage_record_types)).toHaveLength(types.length);
  } finally {
    await f.close();
  }
});
