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
