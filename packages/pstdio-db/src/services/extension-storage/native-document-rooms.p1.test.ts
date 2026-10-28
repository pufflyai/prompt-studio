import { afterEach, expect, test } from "bun:test";
import { createNativeDocumentKey } from "pstdio-api-contracts";
import { saveTextDocument, seedTextDocument } from "pstdio-sync/text";
import * as Y from "yjs";
import { native_document_room_updates } from "../../db/schemas.pg";
import { createExtensionStorageDBService } from "./extension-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
const fixture = async () => {
  const f = await createExtensionStorageFixture();
  cleanup.push(f.close);
  const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
  const target = { fileRendererId: "ext.example.view.document", resource: undefined };
  const documentKey = createNativeDocumentKey(target);
  const author = new Y.Doc();
  cleanup.push(async () => author.destroy());
  await seedTextDocument(author, "first\nlast");
  return { ...f, owner, target, documentKey, author, rooms: f.svc.nativeRooms };
};

test("room edits survive a service restart and replay without changing their local revision", async () => {
  const f = await fixture();
  const room = await f.rooms.create({ ...f, state: Y.encodeStateAsUpdate(f.author) });
  const before = Y.encodeStateVector(f.author);
  saveTextDocument(f.author, "FIRST\nlast");
  const update = Y.encodeStateAsUpdate(f.author, before);
  await f.rooms.apply({ owner: f.owner, roomId: room.id, update });
  const reopened = createExtensionStorageDBService(f.db).nativeRooms;
  const saved = await reopened.read({ owner: f.owner, roomId: room.id });
  expect(saved.document.getText("content").toString()).toBe("FIRST\nlast");
  const revision = saved.revision;
  saved.document.destroy();
  await reopened.apply({ owner: f.owner, roomId: room.id, update });
  const replay = await reopened.read({ owner: f.owner, roomId: room.id });
  expect(replay.revision).toBe(revision);
  replay.document.destroy();
});

test("room access is scoped to its owning project and extension", async () => {
  const f = await fixture();
  const room = await f.rooms.create({ ...f, state: Y.encodeStateAsUpdate(f.author) });
  for (const owner of [
    { ...f.owner, workbenchId: f.projectBId },
    { ...f.owner, extensionId: "another.extension" },
  ]) {
    await expect(f.rooms.read({ owner, roomId: room.id })).rejects.toThrow("not found");
    await expect(f.rooms.apply({ owner, roomId: room.id, update: new Uint8Array([0, 0]) })).rejects.toThrow(
      "not found",
    );
    expect(await f.rooms.remove({ owner, roomId: room.id })).toBe(false);
  }
  expect(await f.rooms.remove({ owner: f.owner, roomId: room.id })).toBe(true);
});

test("a frame with missing dependencies rolls back and can be repaired from its original history", async () => {
  const f = await fixture();
  const room = await f.rooms.create({ ...f, state: Y.encodeStateAsUpdate(f.author) });
  saveTextDocument(f.author, "FIRST\nlast");
  const afterFirst = Y.encodeStateVector(f.author);
  saveTextDocument(f.author, "FIRST\nLAST");
  const update = Y.encodeStateAsUpdate(f.author, afterFirst);
  await expect(f.rooms.apply({ owner: f.owner, roomId: room.id, update })).rejects.toThrow("missing causal history");
  const unchanged = await f.rooms.read({ owner: f.owner, roomId: room.id });
  expect(unchanged.document.getText("content").toString()).toBe("first\nlast");
  const repair = Y.encodeStateAsUpdate(f.author, Y.encodeStateVector(unchanged.document));
  unchanged.document.destroy();
  await f.rooms.apply({ owner: f.owner, roomId: room.id, update: repair });
  const repaired = await f.rooms.read({ owner: f.owner, roomId: room.id });
  expect(repaired.document.getText("content").toString()).toBe("FIRST\nLAST");
  repaired.document.destroy();
});

test("recovery discovers room addresses without loading unrelated document bodies", async () => {
  const f = await fixture();
  const room = await f.rooms.create({ ...f, state: Y.encodeStateAsUpdate(f.author) });
  const addresses = [];
  for await (const address of f.rooms.pending()) addresses.push(address);
  expect(addresses).toEqual([{ id: room.id, owner: f.owner, documentKey: f.documentKey }]);
  expect(await f.rooms.source({ owner: f.owner, documentKey: f.documentKey })).toMatchObject({
    fileRendererId: f.target.fileRendererId,
  });
});

test("long-lived rooms fold their update journal and reopen with every edit", async () => {
  const f = await fixture();
  const room = await f.rooms.create({ ...f, state: Y.encodeStateAsUpdate(f.author) });
  for (let index = 0; index < 130; index++) {
    const before = Y.encodeStateVector(f.author);
    f.author.getText("content").insert(f.author.getText("content").length, String(index % 10));
    await f.rooms.apply({ owner: f.owner, roomId: room.id, update: Y.encodeStateAsUpdate(f.author, before) });
  }
  expect(await f.db.select().from(native_document_room_updates)).toHaveLength(2);
  const reopened = createExtensionStorageDBService(f.db).nativeRooms;
  const saved = await reopened.read({ owner: f.owner, roomId: room.id });
  expect(saved.document.getText("content").toString()).toBe(f.author.getText("content").toString());
  expect(saved.revision).toBe(130);
  saved.document.destroy();
});
