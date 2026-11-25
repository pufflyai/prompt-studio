import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNativeDocumentKey } from "pstdio-api-contracts";
import { seedTextDocument } from "pstdio-sync/text";
import * as Y from "yjs";
import { createDb } from "../../db/connection.pglite";
import { createExtensionStorageDBService } from "./extension-storage";
import { populateExtensionStorageFixture } from "./extension-storage.fixture";

test("saved text and private editor history reopen from files without document bytes in SQL", async () => {
  const root = await mkdtemp(join(tmpdir(), "document-files-"));
  const path = join(root, "database");
  let connection: Awaited<ReturnType<typeof createDb>> | undefined;
  let storage: ReturnType<typeof createExtensionStorageDBService> | undefined;
  const author = new Y.Doc();
  try {
    connection = await createDb({ path });
    const fixture = await populateExtensionStorageFixture(connection);
    storage = fixture.svc;
    const owner = { workbenchId: fixture.projectAId, extensionId: "ext.example" };
    const text = "Saved text 日本語\0🦉";
    await storage.openTextDocument({ owner, fileId: "notes" }).save(text);
    const target = { fileRendererId: "ext.example.view.document", resource: undefined };
    const documentKey = createNativeDocumentKey(target);
    await seedTextDocument(author, "Private editor history");
    const room = await storage.nativeRooms.create({ owner, documentKey, target, state: Y.encodeStateAsUpdate(author) });
    const before = Y.encodeStateVector(author);
    author.getText("content").insert(author.getText("content").length, " 🦉");
    await storage.nativeRooms.apply({ owner, roomId: room.id, update: Y.encodeStateAsUpdate(author, before) });
    const { rows } = await connection.pglite.query(
      `SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'
      AND data_type='bytea' AND table_name IN ('storage_documents','storage_document_updates',
      'native_document_rooms','native_document_room_updates','documents') ORDER BY table_name,column_name`,
    );
    expect(rows).toEqual([]);
    expect(existsSync(`${path}-documents`)).toBe(true);
    await storage.flushStatistics();
    await connection.close();
    connection = await createDb({ path });
    storage = createExtensionStorageDBService(connection.db);
    expect(await storage.openTextDocument({ owner, fileId: "notes" }).read()).toBe(text);
    const saved = await storage.nativeRooms.read({ owner, roomId: room.id });
    try {
      expect(saved.revision).toBe(1);
      expect(saved.document.getText("content").toString()).toBe("Private editor history 🦉");
    } finally {
      saved.document.destroy();
    }
  } finally {
    author.destroy();
    await storage?.flushStatistics();
    await connection?.close();
    await rm(root, { recursive: true, force: true });
  }
});

for (const mode of ["mkdir", "rename", "concurrent", "rollback", "batch", "ancestry", "reentrant", "collection"])
  test(`document files preserve ${mode} durability`, async () => {
    const child = Bun.spawn(
      [process.execPath, join(import.meta.dirname, "document-files-durability.fixture.ts"), mode],
      {
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [stdout, stderr, exit] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect({ exit, stderr }).toEqual({ exit: 0, stderr: "" });
    expect(JSON.parse(stdout.trim())).toEqual({ mode, verified: true });
  });
