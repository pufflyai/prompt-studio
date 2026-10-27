import { afterEach, expect, test } from "bun:test";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
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
