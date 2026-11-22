import { expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { createNativeDocumentKey } from "pstdio-api-contracts";
import { seedTextDocument } from "pstdio-sync/text";
import * as Y from "yjs";
import { roomDocumentId } from "./document-kind";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

test("native rooms and unfinished file saves follow owner deletion and recreation", async () => {
  const f = await createExtensionStorageFixture();
  const first = { workbenchId: f.projectAId, extensionId: "example.first" };
  const other = { ...first, extensionId: "example.other" };
  const target = { fileRendererId: "example.editor", resource: undefined };
  const documentKey = createNativeDocumentKey(target);
  const state = async (text: string) => {
    const document = new Y.Doc();
    try {
      await seedTextDocument(document, text);
      return Y.encodeStateAsUpdate(document);
    } finally {
      document.destroy();
    }
  };
  try {
    const initial = await state("Before 🦉");
    const rooms = [];
    for (const owner of [first, other]) {
      rooms.push(await f.svc.nativeRooms.create({ owner, documentKey, target, state: initial }));
      await f.svc.nativeFileProjections.initialize({ owner, documentKey, state: initial });
      await f.svc.nativeFileProjections.begin({ owner, documentKey, state: initial });
    }
    const read = async (owner: typeof first, roomId: string) => {
      const result = await f.svc.nativeRooms.read({ owner, roomId });
      try {
        return result.document.getText("content").toString();
      } finally {
        result.document.destroy();
      }
    };
    expect(await read(first, rooms[0]!.id)).toBe("Before 🦉");
    const before = await f.db.execute<{ owner_id: number }>(sql`SELECT owner_id FROM documents
      WHERE key=${roomDocumentId(rooms[0]!.id)}`);
    expect(before.rows[0]!.owner_id).toBeNumber();
    await f.db.execute(sql`DELETE FROM owners WHERE project_id=${first.workbenchId}
      AND extension_id=${first.extensionId}`);
    expect(
      (
        await f.db.execute(sql`SELECT 1 FROM file_projections
      WHERE owner_id=${before.rows[0]!.owner_id}`)
      ).rows,
    ).toEqual([]);
    await expect(read(first, rooms[0]!.id)).rejects.toThrow("not found");
    expect(await f.svc.nativeFileProjections.read({ owner: first, documentKey })).toBeUndefined();
    expect(await Array.fromAsync(f.svc.nativeFileProjections.pending())).toEqual([{ owner: other, documentKey }]);
    expect(await read(other, rooms[1]!.id)).toBe("Before 🦉");
    const fresh = await f.svc.nativeRooms.create({ owner: first, documentKey, target, state: await state("After") });
    // A restored room may reuse its stable room ID and revision under the recreated owner.
    await f.db.execute(
      sql`UPDATE documents SET key=${roomDocumentId(rooms[0]!.id)} WHERE key=${roomDocumentId(fresh.id)}`,
    );
    expect(await read(first, rooms[0]!.id)).toBe("After");
    const after = await f.db.execute<{ owner_id: number }>(sql`SELECT owner_id FROM documents
      WHERE key=${roomDocumentId(rooms[0]!.id)}`);
    expect(after.rows[0]!.owner_id).not.toBe(before.rows[0]!.owner_id);
    expect((await Array.fromAsync(f.svc.nativeRooms.pending())).map((row) => row.owner)).toEqual(
      expect.arrayContaining([first, other]),
    );
  } finally {
    await f.close();
  }
});
