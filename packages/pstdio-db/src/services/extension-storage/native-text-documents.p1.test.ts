import { afterEach, expect, test } from "bun:test";
import type { StorageOwner } from "pstdio-sync";
import { readTextDocumentSeed, saveTextDocument, seedTextDocument } from "pstdio-sync/text";
import * as Y from "yjs";
import { storage_document_updates, storage_documents } from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
const fixture = async () => {
  const f = await createExtensionStorageFixture();
  cleanup.push(f.close);
  const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
  const service = createDocumentStorageDBService(f.db);
  const text = service.openNativeTextDocument({ owner, fileId: "file-view-key" });
  return { ...f, owner, service, text };
};

test("native text seeds once and reopens without creating an owner or record document", async () => {
  const f = await fixture();
  await f.text.seed("first\nlast");
  await f.text.seed("stale load");
  const reopened = createDocumentStorageDBService(f.db).openNativeTextDocument({
    owner: f.owner,
    fileId: "file-view-key",
  });
  expect(await reopened.read()).toBe("first\nlast");
  const rows = await f.db.select({ id: storage_documents.document_id }).from(storage_documents);
  expect(rows).toEqual([{ id: '["native-markdown","file-view-key"]' }]);
});

test("committed text changes announce their exact standalone document identity", async () => {
  const f = await fixture();
  await f.text.seed("before");
  const events: { owner: StorageOwner; name: string | undefined; content: Promise<string> }[] = [];
  const stop = f.service.watch((owner, name) => events.push({ owner, name, content: f.text.read() }));
  try {
    await f.text.save("after");
    expect(events).toHaveLength(1);
    expect(events[0]!.owner).toEqual(f.owner);
    expect(events[0]!.name).toBe('["native-markdown","file-view-key"]');
    expect(await events[0]!.content).toBe("after");
  } finally {
    stop();
  }
});

test("native text adopts atomically and invalidates previously cached copies", async () => {
  const first = await fixture();
  const second = await fixture();
  await first.text.seed("first\nlast");
  await second.text.seed("first\nlast");
  await first.text.save("FIRST\nlast");
  await second.text.save("first\nLAST");
  const cached = createDocumentStorageDBService(second.db).openNativeTextDocument({
    owner: second.owner,
    fileId: "file-view-key",
  });
  expect(await cached.read()).toBe("first\nLAST");
  const remote = await first.text.store.transaction(first.owner, async ({ document }) => {
    const Y = await import("yjs");
    const snapshot = new Y.Doc();
    Y.applyUpdate(snapshot, Y.encodeStateAsUpdate(document));
    return snapshot;
  });
  const candidate = await second.text.store.initialHistory.prepare(second.owner, remote);
  expect(await second.text.read()).toBe("first\nLAST");
  const merged = await second.text.store.initialHistory.merge(second.owner, candidate!);
  merged!.destroy();
  candidate!.destroy();
  remote.destroy();
  expect(await second.text.read()).toBe("FIRST\nLAST");
  expect(await cached.read()).toBe("FIRST\nLAST");
  expect(await second.db.select().from(storage_document_updates)).toHaveLength(0);
  const [row] = await second.db.select().from(storage_documents);
  expect(row!.revision).toBe(row!.folded_revision);
  const reopened = createDocumentStorageDBService(second.db).openNativeTextDocument({
    owner: second.owner,
    fileId: "file-view-key",
  });
  expect(await reopened.read()).toBe("FIRST\nLAST");
});

test("background sync adopts a native document before its editor is first opened", async () => {
  const first = await fixture();
  const second = await fixture();
  await first.text.seed("downloaded source");
  const Y = await import("yjs");
  const remote = new Y.Doc();
  Y.applyUpdate(remote, await first.text.exportUpdate());
  const merged = await second.text.store.initialHistory.merge(second.owner, remote);
  merged!.destroy();
  remote.destroy();
  expect(await second.text.read()).toBe("downloaded source");
  await second.text.seed("outdated load");
  expect(await second.text.read()).toBe("downloaded source");
});

test("editor source histories merge durably and duplicate frames stay quiet for that document", async () => {
  const f = await fixture();
  await f.text.seed("first\nlast");
  const source = new Y.Doc();
  Y.applyUpdate(source, await f.text.exportUpdate());
  await f.text.save("FIRST\nlast");
  saveTextDocument(source, "first\nLAST");
  let notifications = 0;
  const stop = f.text.watch(() => notifications++);
  const other = f.service.openNativeTextDocument({ owner: f.owner, fileId: "other-file" });
  await other.seed("other");
  await f.text.applySource(source);
  expect(await f.text.read()).toBe("FIRST\nLAST");
  await f.text.applySource(source);
  expect(notifications).toBe(1);
  const reopened = createDocumentStorageDBService(f.db).openNativeTextDocument({
    owner: f.owner,
    fileId: "file-view-key",
  });
  expect(await reopened.read()).toBe("FIRST\nLAST");
  stop();
  source.destroy();
});

test("an older room history can save local edits while keeping the current canonical root", async () => {
  const f = await fixture();
  await f.text.seed("first\nlast");
  await f.text.save("FIRST\nlast");
  const canonical = new Y.Doc();
  Y.applyUpdate(canonical, await f.text.exportUpdate());
  const canonicalSeed = await readTextDocumentSeed(canonical);
  const source = new Y.Doc();
  await seedTextDocument(source, "first\nlast");
  saveTextDocument(source, "first\nLAST");
  await f.text.applySource(source);
  expect(await f.text.read()).toBe("FIRST\nLAST");
  const merged = new Y.Doc();
  Y.applyUpdate(merged, await f.text.exportUpdate());
  expect((await readTextDocumentSeed(merged)).id).toBe(canonicalSeed.id);
  let changes = 0;
  const stop = f.text.watch(() => changes++);
  await f.text.applySource(source);
  expect(changes).toBe(0);
  stop();
  expect(await f.db.select({ id: storage_documents.document_id }).from(storage_documents)).toEqual([
    { id: '["native-markdown","file-view-key"]' },
  ]);
  source.destroy();
  canonical.destroy();
  merged.destroy();
});

test("an editor frame missing causal history is not acknowledged or persisted", async () => {
  const f = await fixture();
  await f.text.seed("original");
  const source = new Y.Doc();
  const author = new Y.Doc();
  const state = await f.text.exportUpdate();
  Y.applyUpdate(source, state);
  Y.applyUpdate(author, state);
  saveTextDocument(author, "original A");
  const afterFirstEdit = Y.encodeStateVector(author);
  saveTextDocument(author, "original AB");
  Y.applyUpdate(source, Y.encodeStateAsUpdate(author, afterFirstEdit));
  expect(source.store.pendingStructs).not.toBeNull();
  let changes = 0;
  const stop = f.text.watch(() => changes++);
  await expect(f.text.applySource(source)).rejects.toThrow("missing causal history");
  expect(await f.text.read()).toBe("original");
  expect(changes).toBe(0);
  // Repair uses the original source history; the rejected frame is not lost.
  Y.applyUpdate(source, Y.encodeStateAsUpdate(author, Y.encodeStateVector(source)));
  await f.text.applySource(source);
  expect(await f.text.read()).toBe("original AB");
  expect(changes).toBe(1);
  stop();
  source.destroy();
  author.destroy();
});

test("a missing native document is pending data while a seeded empty file is readable", async () => {
  const f = await fixture();
  await expect(f.text.read()).rejects.toMatchObject({ code: "native_source_pending" });
  await f.text.seed("");
  expect(await f.text.read()).toBe("");
});
