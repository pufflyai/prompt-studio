import { afterEach, expect, test } from "bun:test";
import { createNativeDocumentKey } from "pstdio-api-contracts";
import { seedTextDocument } from "pstdio-sync/text";
import * as Y from "yjs";
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
  const document = new Y.Doc();
  await seedTextDocument(document, "first\nlast");
  const state = Y.encodeStateAsUpdate(document);
  document.destroy();
  await f.svc.nativeRooms.create({ owner, documentKey, target, state });
  return { ...f, owner, documentKey, state, projections: f.svc.nativeFileProjections };
};

test("file projection intent survives restart and only its matching completion clears it", async () => {
  const f = await fixture();
  const address = { owner: f.owner, documentKey: f.documentKey };
  await f.projections.initialize({ ...address, state: f.state });
  const other = new Y.Doc();
  Y.applyUpdate(other, f.state);
  other.getText("content").insert(0, "NEW ");
  const next = Y.encodeStateAsUpdate(other);
  other.destroy();
  await f.projections.begin({ ...address, state: next });
  const reopened = createExtensionStorageDBService(f.db).nativeFileProjections;
  expect(await reopened.read(address)).toEqual({ baseline: f.state, pending: next });
  expect(await reopened.complete({ ...address, state: f.state })).toBe(false);
  expect((await reopened.read(address))?.pending).toEqual(next);
  expect(await reopened.complete({ ...address, state: next })).toBe(true);
  expect(await reopened.read(address)).toEqual({ baseline: next, pending: null });
});

test("file projection initialization preserves the first baseline and scopes it to its source", async () => {
  const f = await fixture();
  const address = { owner: f.owner, documentKey: f.documentKey };
  await f.projections.initialize({ ...address, state: f.state });
  await f.projections.initialize({ ...address, state: new Uint8Array([0, 0]) });
  expect((await f.projections.read(address))?.baseline).toEqual(f.state);
  expect(await f.projections.read({ ...address, owner: { ...f.owner, extensionId: "another" } })).toBeUndefined();
  await f.projections.begin({ ...address, state: f.state });
  expect(await Array.fromAsync(f.projections.pending())).toEqual([address]);
});
