import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { createNativeDocumentKey } from "pstdio-api-contracts";
import { seedTextDocument } from "pstdio-sync/text";
import * as Y from "yjs";
import { createDb } from "../../db/connection.pglite";
import { documents, file_projections } from "../../db/schemas.pg";
import { readFileDocumentHead } from "./document-file-persistence";
import { pruneDocumentFiles } from "./document-file-retention";
import { documentFilesFor } from "./document-files";
import { nativeDocumentId, roomDocumentId } from "./document-kind";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture, populateExtensionStorageFixture } from "./extension-storage.fixture";
import { ensureStorageOwner } from "./storage-owner-key";

const folder = (path: string, project: string, id: number) =>
  join(`${path}-documents`, `p-${Buffer.from(project).toString("hex")}`, String(id));

test("a rejected save keeps the committed text and collects its unpublished file generation before retry", async () => {
  const root = await mkdtemp(join(tmpdir(), "document-save-rollback-"));
  const path = join(root, "database");
  const connection = await createDb({ path });
  const f = await populateExtensionStorageFixture(connection);
  const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
  const text = f.svc.openTextDocument({ owner, fileId: "notes" });
  try {
    await text.save("Committed 日本語\0");
    const [row] = await f.db.select().from(documents).where(eq(documents.key, '["text-file","notes"]'));
    const directory = folder(path, owner.workbenchId, row!.id);
    const before = (await readdir(directory)).sort();
    await connection.pglite.exec(`CREATE FUNCTION reject_document_save() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.key='["text-file","notes"]' THEN RAISE EXCEPTION 'reject publication'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_document_save BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION reject_document_save()`);
    await expect(text.save("Rejected replacement")).rejects.toThrow("Failed query");
    const cold = createDocumentStorageDBService(f.db);
    try {
      expect(await cold.openTextDocument({ owner, fileId: "notes" }).read()).toBe("Committed 日本語\0");
    } finally {
      await cold.flushStatistics();
    }
    expect((await readdir(directory)).sort()).toEqual(before);
    await connection.pglite.exec("DROP TRIGGER reject_document_save ON documents");
    await text.save("Successful retry");
    expect(await text.read()).toBe("Successful retry");
  } finally {
    await f.svc.flushStatistics();
    await connection.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("collection preserves older files when a committed snapshot is damaged and resumes after repair", async () => {
  const root = await mkdtemp(join(tmpdir(), "document-damaged-closure-"));
  const path = join(root, "database");
  const connection = await createDb({ path });
  const f = await populateExtensionStorageFixture(connection);
  const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
  try {
    await f.svc.openTextDocument({ owner, fileId: "notes" }).save("Saved text");
    await f.svc.openTextDocument({ owner, fileId: "other" }).save("Unrelated saved text");
    const [row] = await f.db.select().from(documents).where(eq(documents.key, '["text-file","notes"]'));
    const files = documentFilesFor(f.db);
    const head = await f.db.transaction((tx) => readFileDocumentHead(documentFilesFor(tx), owner.workbenchId, row!));
    const snapshot = await files.read(owner.workbenchId, row!.id, "state", head.snapshot);
    const directory = folder(path, owner.workbenchId, row!.id);
    const original = join(directory, files.name("state", head.snapshot));
    const orphan = await files.put(owner.workbenchId, row!.id, "state", new Uint8Array([9, 8, 7]));
    const older = join(directory, files.name("state", orphan));
    await writeFile(original, "damaged snapshot");
    await pruneDocumentFiles(f.db, owner.workbenchId, [row!.id]);
    expect(existsSync(older)).toBe(true);
    const cold = createDocumentStorageDBService(f.db);
    try {
      await expect(cold.openTextDocument({ owner, fileId: "notes" }).read()).rejects.toThrow("damaged");
      expect(await cold.openTextDocument({ owner, fileId: "other" }).read()).toBe("Unrelated saved text");
      await writeFile(original, snapshot);
      expect(await cold.openTextDocument({ owner, fileId: "notes" }).read()).toBe("Saved text");
    } finally {
      await cold.flushStatistics();
    }
    await pruneDocumentFiles(f.db, owner.workbenchId, [row!.id]);
    expect(existsSync(older)).toBe(false);
  } finally {
    await f.svc.flushStatistics();
    await connection.close();
    await rm(root, { recursive: true, force: true });
  }
});

const rejectsForeignKey = async (operation: PromiseLike<unknown>) => {
  let rejected = false;
  try {
    await operation;
  } catch (error) {
    rejected = true;
    expect(String((error as { cause?: Error }).cause?.message)).toContain("foreign key");
  }
  expect(rejected).toBe(true);
};

test("private editor rooms stay out of shared discovery and cannot point across owner boundaries", async () => {
  const f = await createExtensionStorageFixture();
  const storage = createDocumentStorageDBService(f.db);
  const author = new Y.Doc();
  const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
  const target = { fileRendererId: "example.editor", resource: undefined };
  const documentKey = createNativeDocumentKey(target);
  try {
    await seedTextDocument(author, "Private draft");
    const room = await f.svc.nativeRooms.create({ owner, documentKey, target, state: Y.encodeStateAsUpdate(author) });
    expect(await storage.hasData(owner)).toBe(false);
    expect(await storage.documents.list(owner)).toEqual(["records"]);
    await expect(storage.documents.open(roomDocumentId(room.id)).transaction(owner, async () => {})).rejects.toThrow(
      "Private editor",
    );
    const [source] = await f.db
      .select()
      .from(documents)
      .where(eq(documents.key, nativeDocumentId(documentKey)));
    const [privateRow] = await f.db
      .select()
      .from(documents)
      .where(eq(documents.key, roomDocumentId(room.id)));
    const other = await ensureStorageOwner(f.db, { ...owner, extensionId: "example.other" });
    await rejectsForeignKey(
      f.db.insert(documents).values({
        ...privateRow!,
        id: undefined,
        owner_id: other,
        key: roomDocumentId("cross-owner"),
        room_of: source!.id,
      }),
    );
    await rejectsForeignKey(
      f.db
        .insert(file_projections)
        .values({ owner_id: other, root: '["native","handler"]', path: documentKey, document_id: source!.id }),
    );
    await storage.openNativeTextDocument({ owner, fileId: documentKey }).seed("Shared source");
    expect(await storage.documents.list(owner)).toContain(nativeDocumentId(documentKey));
    expect(await storage.hasData(owner)).toBe(true);
  } finally {
    author.destroy();
    await storage.flushStatistics();
    await f.svc.flushStatistics();
    await f.close();
  }
});

test.each([
  "memory",
  "disk",
])("caller buffers and returned bytes cannot change a saved immutable %s document object", async (mode) => {
  const { createDocumentFiles } = await import("./document-files");
  const root = mode === "disk" ? await mkdtemp(join(tmpdir(), "document-buffer-copy-")) : undefined;
  const files = createDocumentFiles(root);
  try {
    const original = Buffer.from([0, 255, 7]);
    const pending = files.put("project", 1, "state", original);
    original.fill(9);
    const reference = await pending;
    const first = await files.read("project", 1, "state", reference);
    expect([...first]).toEqual([0, 255, 7]);
    first.fill(8);
    expect([...(await files.read("project", 1, "state", reference))]).toEqual([0, 255, 7]);
  } finally {
    if (root) await rm(root, { recursive: true, force: true });
  }
});
