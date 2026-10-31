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
  await retired.save("late retired edit");
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
