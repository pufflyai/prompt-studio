import { afterEach, expect, test } from "bun:test";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

test("an existing source binding rejects transformed bytes instead of validating another projector", async () => {
  const f = await createExtensionStorageFixture();
  cleanup.push(f.close);
  const owner = { workbenchId: f.projectAId, extensionId: "example.notes" };
  const service = createDocumentStorageDBService(f.db);
  const records = service.open({ owner }).records;
  await records.commit({
    operationId: "create",
    edits: [{ recordId: "body", replace: { content: "complete source" } }],
  });
  const source = { recordId: "body", field: "/content", documentKey: "c".repeat(64) };
  await records.bindText({ ...source, content: "complete source" });
  await expect(records.bindText({ ...source, content: "fragment" })).rejects.toThrow("full source bytes");
});

test.each([
  "original",
  "replacement",
])("record recreation with %s bytes starts a fresh text authority", async (content) => {
  const f = await createExtensionStorageFixture();
  cleanup.push(f.close);
  const owner = { workbenchId: f.projectAId, extensionId: "example.notes" };
  const service = createDocumentStorageDBService(f.db);
  const records = service.open({ owner }).records;
  const source = { recordId: "note", field: "/content", documentKey: "b".repeat(64) };
  await records.commit({ operationId: "create", edits: [{ recordId: "note", replace: { content: "original" } }] });
  const first = await records.bindText(source);
  const retired = service.openNativeTextDocument({ owner, fileId: first.documentKey });
  await retired.save("retired edits");
  await records.commit({ operationId: "delete", edits: [{ recordId: "note", deleted: true }] });
  await records.commit({
    operationId: "recreate",
    edits: [{ recordId: "note", deleted: false, replace: { content } }],
  });
  const next = await records.bindText(source);
  expect(next.documentKey).not.toBe(first.documentKey);
  const text = service.openNativeTextDocument({ owner, fileId: next.documentKey });
  expect(await text.read()).toBe(content);
  await expect(retired.save("late retired edit")).rejects.toMatchObject({ code: "native_source_retired" });
  expect((await records.read("note")).value).toEqual({ content });
  expect(await text.read()).toBe(content);
  const reopened = createDocumentStorageDBService(f.db).open({ owner }).records;
  expect((await reopened.bindText(source)).documentKey).toBe(next.documentKey);
});

test("a bound record field reads the standalone text and ordinary record writes update the same authority", async () => {
  const f = await createExtensionStorageFixture();
  cleanup.push(f.close);
  const owner = { workbenchId: f.projectAId, extensionId: "example.notes" };
  const service = createDocumentStorageDBService(f.db);
  const records = service.open({ owner }).records;
  await records.commit({
    operationId: "create",
    edits: [{ recordId: "ticket", replace: { title: "Plan", content: "first\nlast" } }],
  });
  const documentKey = "a".repeat(64);
  await records.bindText({ recordId: "ticket", field: "/content", documentKey });
  const text = service.openNativeTextDocument({ owner, fileId: documentKey });
  await text.save("PEER first\nlast");
  expect((await records.read("ticket")).value).toEqual({ title: "Plan", content: "PEER first\nlast" });
  await records.commit({
    operationId: "edit",
    edits: [{ recordId: "ticket", replace: { title: "Renamed", content: "PEER first\nlast CLI" } }],
  });
  expect(await text.read()).toBe("PEER first\nlast CLI");
  expect((await records.read("ticket")).value).toEqual({ title: "Renamed", content: "PEER first\nlast CLI" });
  const reopened = createDocumentStorageDBService(f.db);
  expect((await reopened.open({ owner }).records.read("ticket")).value).toEqual({
    title: "Renamed",
    content: "PEER first\nlast CLI",
  });
});

test("ordinary ordered edits notify a bound editor and advance its native snapshot revision", async () => {
  const f = await createExtensionStorageFixture();
  cleanup.push(f.close);
  const owner = { workbenchId: f.projectAId, extensionId: "example.notes" };
  const service = createDocumentStorageDBService(f.db);
  const records = service.open({ owner }).records;
  await records.commit({
    operationId: "watch-create",
    edits: [{ recordId: "note", replace: { content: "original" } }],
  });
  const key = "9".repeat(64);
  await records.bindText({ recordId: "note", field: "/content", documentKey: key });
  const native = service.openNativeTextDocument({ owner, fileId: key });
  const before = await native.snapshot();
  let notifications = 0;
  const stop = native.watch(() => {
    notifications++;
  });
  cleanup.push(async () => stop());
  await records.commit({ operationId: "watch-write", edits: [{ recordId: "note", set: { "/content": "updated" } }] });
  expect(notifications).toBeGreaterThan(0);
  const after = await native.snapshot();
  expect(after.revision).toBeGreaterThan(before.revision);
  expect(await native.store.revision!(owner)).toBe(after.revision);
  expect(await native.read()).toBe("updated");
});

test("removing and readding a declared field starts fresh history and fences the old editor", async () => {
  const f = await createExtensionStorageFixture();
  cleanup.push(f.close);
  const owner = { workbenchId: f.projectAId, extensionId: "example.notes" };
  const service = createDocumentStorageDBService(f.db);
  const records = service.open({ owner, textFields: [{ prefix: "note", fields: ["/content"] }] }).records;
  await records.commit({
    operationId: "field-create",
    edits: [{ recordId: "note", replace: { content: "original" } }],
  });
  const key = "8".repeat(64);
  await records.bindText({ recordId: "note", field: "/content", documentKey: key });
  const native = service.openNativeTextDocument({ owner, fileId: key });
  const before = await native.snapshot();
  await records.commit({ operationId: "field-remove", edits: [{ recordId: "note", unset: ["/content"] }] });
  expect((await records.read("note")).value).toEqual({});
  await expect(native.read()).rejects.toMatchObject({ code: "native_source_retired" });
  await records.commit({ operationId: "field-add", edits: [{ recordId: "note", set: { "/content": "original" } }] });
  const next = await records.bindText({ recordId: "note", field: "/content", documentKey: key });
  const current = service.openNativeTextDocument({ owner, fileId: next.documentKey });
  const after = await current.snapshot();
  expect(after.generation).not.toBe(before.generation);
  const stale = new (await import("yjs")).Doc();
  try {
    (await import("yjs")).applyUpdate(stale, before.state);
    await expect(current.applySource(stale, { generation: before.generation })).rejects.toMatchObject({
      code: "native_source_recovery",
    });
  } finally {
    stale.destroy();
  }
  expect(await current.read()).toBe("original");
});

test("binding a real editable file after discovery registers its native owner for sync", async () => {
  const f = await createExtensionStorageFixture();
  cleanup.push(f.close);
  const owner = { workbenchId: f.projectAId, extensionId: "example.notes" };
  const service = createDocumentStorageDBService(f.db);
  await service.documents.list(owner);
  const { createAssets } = await import("./record-stream-relay.fixture");
  const assets = createAssets();
  const bytes = new TextEncoder().encode("real file");
  const sha256 = new (await import("bun")).CryptoHasher("sha256").update(bytes).digest("hex");
  const asset = { sha256, byteLength: bytes.length, mediaType: "text/plain" };
  assets.files.set(sha256, bytes);
  const records = service.open({ owner, assets: assets.store }).records;
  await records.commit({
    operationId: "file-create",
    edits: [{ recordId: "file", replace: { path: "note.md" }, asset }],
  });
  const key = "7".repeat(64);
  await records.bindText({ recordId: "file", documentKey: key, content: "real file" });
  expect(await service.documents.list(owner)).toContain(JSON.stringify(["native-markdown", key]));
  expect(await createDocumentStorageDBService(f.db).documents.list(owner)).toContain(
    JSON.stringify(["native-markdown", key]),
  );
});
