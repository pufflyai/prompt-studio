import { afterEach, expect, test } from "bun:test";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { createProjectionStatistics } from "./projection-statistics";
import { createResourceRecords as createLegacyRecords } from "./resource-records";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
const fixture = async () => {
  const f = await createExtensionStorageFixture();
  cleanup.push(f.close);
  const owner = { workbenchId: f.projectAId, extensionId: "example.migration" };
  const statistics = createProjectionStatistics(f.db);
  cleanup.push(statistics.flush);
  return { ...f, owner, legacy: createLegacyRecords(f.db, owner, { statistics, changed: () => {} }) };
};

test("legacy migration retains deleted values and explicit native field history without a second sync owner", async () => {
  const f = await fixture();
  await f.legacy.commit({
    operationId: "old",
    edits: [
      { recordId: "removed", replace: { saved: "retained" }, shared: [{ kind: "map.set", key: "kept", value: true }] },
      { recordId: "ticket", replace: { title: "plain\ntitle", content: "first\nlast" } },
    ],
  });
  await f.legacy.commit({ operationId: "delete", edits: [{ recordId: "removed", deleted: true }] });
  const key = "d".repeat(64);
  await f.legacy.bindText({ recordId: "ticket", field: "/content", documentKey: key });
  const oldDocuments = createDocumentStorageDBService(f.db);
  await oldDocuments.openNativeTextDocument({ owner: f.owner, fileId: key }).save("EDIT first\nlast");
  const service = createDocumentStorageDBService(f.db);
  const records = service.open({ owner: f.owner }).records;
  expect((await records.read("ticket")).value).toEqual({ title: "plain\ntitle", content: "EDIT first\nlast" });
  await records.commit({ operationId: "restore", edits: [{ recordId: "removed", deleted: false }] });
  expect((await records.read("removed")).value).toEqual({ saved: "retained" });
  expect((await records.read("removed")).shared).toEqual({ kind: "map", value: { kept: true } });
  const native = service.openNativeTextDocument({ owner: f.owner, fileId: key });
  expect(await native.read()).toBe("EDIT first\nlast");
  await native.save("EDIT first\nlast AGAIN");
  expect((await records.read("ticket")).value).toEqual({ title: "plain\ntitle", content: "EDIT first\nlast AGAIN" });
  expect(await service.documents.list(f.owner)).not.toContain(JSON.stringify(["native-markdown", key]));
});

test("the first indexed query after upgrade returns an ordered revision usable by a conditional save", async () => {
  const f = await fixture();
  await f.legacy.defineIndexes([
    {
      name: "titles",
      fields: { title: { path: ["title"], type: "string" } },
      orderBy: [{ field: "title", direction: "asc" }],
    },
  ]);
  await f.legacy.commit({ operationId: "old-query", edits: [{ recordId: "card", replace: { title: "old" } }] });
  const records = createDocumentStorageDBService(f.db).open({ owner: f.owner }).records;
  const page = await records.query({ index: "titles", fields: ["title"] });
  expect(() => JSON.parse(page.records[0]!.revision)).not.toThrow();
  await records.commit({
    operationId: "query-save",
    edits: [{ recordId: "card", expectedRevision: page.records[0]!.revision, set: { "/title": "new" } }],
  });
  expect((await records.query({ index: "titles", fields: ["title"] })).records[0]!.fields).toEqual({ title: "new" });
  expect((await records.aggregate({ index: "titles" })).count).toBe(1);
});
