import { afterEach, expect, test } from "bun:test";
import type { StorageRecordIndex } from "pstdio-sync-contracts";
import * as Y from "yjs";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

const indexes: StorageRecordIndex[] = [
  {
    name: "items",
    fields: {
      title: { path: ["title"], type: "string" },
      status: { path: ["status"], type: "string" },
      tag: { path: ["tags"], type: "array" },
      nested: { path: ["details", "rank"], type: "number" },
    },
    equality: ["status"],
    orderBy: [{ field: "nested", direction: "asc" }],
  },
];

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

test("nested received edits maintain only their owner record and indexed reads never hydrate Yjs", async () => {
  const f = await createExtensionStorageFixture();
  cleanup.push(f.close);
  const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
  const events: { phase: string; records?: number }[] = [];
  const service = createDocumentStorageDBService(f.db, undefined, (event) => events.push(event));
  const storage = service.open({ owner });
  await storage.records.defineIndexes(indexes);
  await storage.records.commit({
    operationId: "seed",
    edits: [
      { recordId: "one", replace: { title: "One", status: "ready", tags: ["a"], details: { rank: 1 } } },
      { recordId: "two", replace: { title: "Two", status: "ready", tags: ["a"], details: { rank: 2 } } },
    ],
  });
  const remote = new Y.Doc();
  Y.applyUpdate(remote, await storage.exportUpdate());
  const name = remote.getMap<string>("records").get("one")!;
  const reference = remote.getMap(name).get("value") as { name: string };
  const nested = remote.getMap(reference.name).get("details") as { name: string };
  const updates: Uint8Array[] = [];
  remote.on("update", (update: Uint8Array) => updates.push(update));
  remote.getMap(nested.name).set("rank", 3);
  events.length = 0;
  await storage.applyUpdate(Y.mergeUpdates(updates));
  expect(events.filter((event) => event.phase === "records-projected").map((event) => event.records)).toEqual([1]);
  const reopened = createDocumentStorageDBService(f.db, undefined, (event) => events.push(event)).open({ owner });
  events.length = 0;
  const page = await reopened.records.query({ index: "items", fields: ["title", "nested"] });
  expect(page.records.map((record) => record.recordId)).toEqual(["two", "one"]);
  expect(page.records[1].fields.nested).toBe(3);
  expect((await reopened.records.readMany(["one", "missing", "two"])).map((record) => record.exists)).toEqual([
    true,
    false,
    true,
  ]);
  expect((await reopened.records.read("one")).revision).toBe(page.records[1].revision);
  expect(events.some((event) => event.phase === "document-loaded")).toBe(false);
  remote.destroy();
});

test("query cursors reject changes and retries and failed groups leave committed membership intact", async () => {
  const f = await createExtensionStorageFixture();
  cleanup.push(f.close);
  const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
  const storage = createDocumentStorageDBService(f.db).open({ owner });
  await storage.records.defineIndexes(indexes);
  const commit = {
    operationId: "seed",
    edits: [
      { recordId: "one", replace: { title: "One", status: "ready", tags: ["a"], details: { rank: 1 } } },
      { recordId: "two", replace: { title: "Two", status: "ready", tags: ["b"], details: { rank: 2 } } },
    ],
  };
  await storage.records.commit(commit);
  const request = { index: "items", limit: 1 };
  const page = await storage.records.query(request);
  await storage.records.commit(commit);
  expect((await storage.records.query({ ...request, cursor: page.cursor! })).records[0].recordId).toBe("two");
  await expect(
    storage.records.commit({
      operationId: "bad",
      edits: [
        { recordId: "one", replace: { status: "bad" } },
        { recordId: "two", shared: [{ kind: "text.delete", index: 10, count: 1 }] },
      ],
    }),
  ).rejects.toThrow();
  expect((await storage.records.query({ ...request, cursor: page.cursor! })).records[0].recordId).toBe("two");
  await storage.records.commit({ operationId: "remove", edits: [{ recordId: "one", deleted: true }] });
  await expect(storage.records.query({ ...request, cursor: page.cursor! })).rejects.toThrow("stale");
  expect((await storage.records.aggregate({ index: "items" })).count).toBe(1);
  const [deleted] = await storage.records.readMany(["one"]);
  expect(deleted.deleted).toBe(true);
  expect(deleted.value).toBeNull();
});

test("index prefixes and owner addresses isolate pages and aggregates", async () => {
  const f = await createExtensionStorageFixture();
  cleanup.push(f.close);
  const service = createDocumentStorageDBService(f.db);
  const first = service.open({ owner: { workbenchId: f.projectAId, extensionId: "ext.example" } });
  const second = service.open({ owner: { workbenchId: f.projectBId, extensionId: "ext.example" } });
  const third = service.open({ owner: { workbenchId: f.projectAId, extensionId: "ext.other" } });
  for (const storage of [first, second, third]) {
    await storage.records.defineIndexes(indexes.map((index) => ({ ...index, prefix: "chosen/" })));
    await storage.records.commit({
      operationId: "save",
      edits: [
        { recordId: "chosen/one", replace: { title: "Visible", status: "ready", details: { rank: 1 } } },
        { recordId: "other/one", replace: { title: "Hidden", status: "ready", details: { rank: 1 } } },
      ],
    });
    expect((await storage.records.query({ index: "items" })).records.map((record) => record.recordId)).toEqual([
      "chosen/one",
    ]);
    expect((await storage.records.aggregate({ index: "items" })).count).toBe(1);
  }
  await first.records.commit({ operationId: "delete", edits: [{ recordId: "chosen/one", deleted: true }] });
  expect((await first.records.aggregate({ index: "items" })).count).toBe(0);
  expect((await second.records.aggregate({ index: "items" })).count).toBe(1);
  expect((await third.records.aggregate({ index: "items" })).count).toBe(1);
});

test("indexed pages filter before limiting and retain stable record order after restart", async () => {
  const f = await createExtensionStorageFixture();
  cleanup.push(f.close);
  const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
  const storage = createDocumentStorageDBService(f.db).open({ owner });
  await storage.records.defineIndexes([
    {
      name: "by-status",
      fields: { status: { path: ["status"], type: "string" }, rank: { path: ["rank"], type: "number" } },
      orderBy: [{ field: "rank", direction: "asc" }],
    },
  ]);
  await storage.records.commit({
    operationId: "seed",
    edits: Array.from({ length: 240 }, (_, index) => ({
      recordId: `row-${String(index).padStart(3, "0")}`,
      replace: { status: index % 2 ? "ready" : "done", rank: Math.floor(index / 4), body: "unselected" },
    })),
  });
  const reopened = createDocumentStorageDBService(f.db).open({ owner });
  const request = {
    index: "by-status",
    where: { field: "status", op: "eq" as const, value: "ready" },
    fields: ["status", "rank"],
    limit: 100,
  };
  const first = await reopened.records.query(request);
  expect(first.records).toHaveLength(100);
  expect(first.records[0].fields).toEqual({ status: "ready", rank: 0 });
  expect(first.records[0]).not.toHaveProperty("value");
  expect(first.cursor).toBeString();
  const second = await reopened.records.query({ ...request, cursor: first.cursor! });
  expect(second.records).toHaveLength(20);
  expect(second.cursor).toBeNull();
  const ids = [...first.records, ...second.records].map((record) => record.recordId);
  expect(ids).toEqual(Array.from({ length: 120 }, (_, index) => `row-${String(index * 2 + 1).padStart(3, "0")}`));
  expect((await reopened.records.aggregate({ ...request, groupBy: "status" })).groups).toEqual([
    { value: "ready", count: 120 },
  ]);
});
