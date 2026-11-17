import { afterEach, expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import type { StorageRecordIndex } from "pstdio-sync-contracts";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
const definition: StorageRecordIndex = {
  name: "documents",
  fields: {
    title: {
      path: ["content"],
      type: "string",
      derive: { kind: "markdownTitle", fallbackPath: ["title"], empty: "Untitled" },
    },
  },
  orderBy: [{ field: "title", direction: "asc" }],
};

test("derived titles filter canonical content after index installation, record changes and restart", async () => {
  const f = await createExtensionStorageFixture();
  cleanup.push(f.close);
  const owner = { workbenchId: f.projectAId, extensionId: "ext.documents" };
  const service = createDocumentStorageDBService(f.db);
  const db = service.open({ owner }).records;
  const memory = createMemoryStorage(owner).records;
  const cases = [
    { content: "```\nhidden\n```\n# **Real [É😀](url)**", expected: "Real É😀" },
    { content: "![only image](url)\n> - `A\u0000B`", expected: "A\u0000B" },
    { content: " ", expected: "Untitled" },
    { content: "", expected: "Fallback" },
  ];
  for (const records of [db, memory]) {
    await records.commit({
      operationId: "seed",
      edits: cases.map((entry, i) => ({
        recordId: String(i),
        replace: { title: "Fallback", content: entry.content },
      })),
    });
    await records.defineIndexes([definition]);
    for (const entry of cases) {
      const page = await records.query({
        index: "documents",
        where: { field: "title", op: "eq", value: entry.expected },
        fields: ["title"],
      });
      expect(page.records.map((record) => record.fields.title)).toEqual([entry.expected]);
    }
    await records.commit({ operationId: "rename", edits: [{ recordId: "0", set: { "/content": "# Z Changed" } }] });
    const page = await records.query({
      index: "documents",
      orderBy: [{ field: "title", direction: "desc" }],
      limit: 1,
    });
    expect(page.records[0].fields.title).toBe("Z Changed");
    expect((await records.read("0")).value).toEqual({ title: "Fallback", content: "# Z Changed" });
  }
  expect(
    (
      await createDocumentStorageDBService(f.db)
        .open({ owner })
        .records.query({ index: "documents", where: { field: "title", op: "eq", value: "Z Changed" } })
    ).records,
  ).toHaveLength(1);
});

test("native text changes refresh a derived query field in the same committed revision", async () => {
  const f = await createExtensionStorageFixture();
  cleanup.push(f.close);
  const owner = { workbenchId: f.projectAId, extensionId: "ext.documents" };
  const service = createDocumentStorageDBService(f.db);
  const records = service.open({ owner }).records;
  await records.defineIndexes([definition]);
  await records.commit({
    operationId: "seed",
    edits: [{ recordId: "note", replace: { title: "Stale", content: "# Original" } }],
  });
  const bound = await records.bindText({ recordId: "note", field: "/content", documentKey: "e".repeat(64) });
  const native = service.openNativeTextDocument({ owner, fileId: bound.documentKey });
  const before = await records.query({ index: "documents" });
  await native.save("# **Changed É😀**\nbody");
  const after = await records.query({ index: "documents", where: { field: "title", op: "eq", value: "Changed É😀" } });
  expect(after.records.map((record) => record.fields.title)).toEqual(["Changed É😀"]);
  expect(after.revision).not.toBe(before.revision);
  expect((await records.read("note")).value).toEqual({ title: "Stale", content: "# **Changed É😀**\nbody" });
});

test("unrelated index field changes do not read canonical bodies or rebuild title projections", async () => {
  const f = await createExtensionStorageFixture();
  cleanup.push(f.close);
  let read = 0;
  const records = createDocumentStorageDBService(f.db, undefined, (event) => {
    if (event.phase === "index-records-read") read += event.records ?? 0;
  }).open({ owner: { workbenchId: f.projectAId, extensionId: "ext.documents" } }).records;
  await records.commit({
    operationId: "seed",
    edits: [{ recordId: "doc", replace: { content: "# Current", status: "ready" } }],
  });
  await records.defineIndexes([definition]);
  expect(read).toBe(1);
  read = 0;
  await records.defineIndexes([
    { ...definition, fields: { ...definition.fields, status: { path: ["status"], type: "string" } } },
  ]);
  expect(read).toBe(0);
  expect((await records.query({ index: "documents" })).records[0].fields.title).toBe("Current");
});

test("changing a derived definition reads its prefixes and preserves other indexes", async () => {
  const f = await createExtensionStorageFixture();
  cleanup.push(f.close);
  let read = 0;
  const records = createDocumentStorageDBService(f.db, undefined, (event) => {
    if (event.phase === "index-records-read") read += event.records ?? 0;
  }).open({ owner: { workbenchId: f.projectAId, extensionId: "ext.documents" } }).records;
  await records.commit({
    operationId: "seed",
    edits: [
      { recordId: "docs/a", replace: { content: "# A", alternate: "# Changed" } },
      { recordId: "others/b", replace: { content: "# B" } },
      { recordId: "new/c", replace: { content: "# C" } },
    ],
  });
  const docs = { ...definition, prefix: "docs/" };
  const others = { ...definition, name: "others", prefix: "others/" };
  await records.defineIndexes([docs, others]);
  expect(read).toBe(2);
  read = 0;
  const changed = { ...docs, fields: { title: { ...definition.fields.title, path: ["alternate"] } } };
  await records.defineIndexes([changed, others]);
  expect(read).toBe(1);
  expect((await records.query({ index: "documents" })).records[0].fields.title).toBe("Changed");
  expect((await records.query({ index: "others" })).records[0].fields.title).toBe("B");
  read = 0;
  await records.defineIndexes([{ ...docs, prefix: "new/" }, others]);
  expect(read).toBe(2);
  expect((await records.query({ index: "documents" })).records[0].fields.title).toBe("C");
  expect((await records.query({ index: "others" })).records[0].fields.title).toBe("B");
});

test("concurrent installations derive values from the final committed definition", async () => {
  const f = await createExtensionStorageFixture();
  cleanup.push(f.close);
  const records = createDocumentStorageDBService(f.db).open({
    owner: { workbenchId: f.projectAId, extensionId: "ext.documents" },
  }).records;
  await records.commit({
    operationId: "seed",
    edits: [{ recordId: "doc", replace: { content: "# Original", alternate: "# Alternate", status: "ready" } }],
  });
  await records.defineIndexes([definition]);
  await Promise.all([
    records.defineIndexes([{ ...definition, fields: { title: { ...definition.fields.title, path: ["alternate"] } } }]),
    records.defineIndexes([
      { ...definition, fields: { ...definition.fields, status: { path: ["status"], type: "string" } } },
    ]),
  ]);
  expect((await records.query({ index: "documents" })).records[0].fields).toEqual({
    title: "Original",
    status: "ready",
  });
});
