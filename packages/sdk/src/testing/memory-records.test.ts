import { expect, test } from "bun:test";
import { createMemoryStorage } from "./memory-storage";

test("seeded extension test storage is ready before the first public or legacy read", async () => {
  const storage = createMemoryStorage({
    kv: { first: "one", second: "two" },
    collections: { notes: { a: { title: "Seeded" } } },
  });
  expect((await storage.records.read(storage.records.id("second"))).value).toBe("two");
  expect(await storage.get<string>("first")).toBe("one");
  expect(await storage.collection("notes").get("a")).toEqual({ title: "Seeded" });
});

test("public records and deprecated KV calls share one local owner and scope", async () => {
  const storage = createMemoryStorage();
  await storage.set("setting", { enabled: false });
  const base = await storage.records.read(storage.records.id("setting"));
  expect(base.value).toEqual({ enabled: false });
  await storage.records.commit({
    operationId: "new-api",
    edits: [{ recordId: base.recordId, expectedRevision: base.revision, replace: { enabled: true } }],
  });
  expect(await storage.get<{ enabled: boolean }>("setting")).toEqual({ enabled: true });
  const other = storage.scope({ type: "resource", resource: { type: "example.note", id: "other" } });
  expect(await other.get("setting")).toBeUndefined();
  await other.set("setting", "scoped");
  expect((await storage.records.read(storage.records.id("setting"))).value).toEqual({ enabled: true });
  expect((await other.records.read(other.records.id("setting"))).value).toBe("scoped");
});

test("a save without an observed revision edits the current record and reports its sync state", async () => {
  const { records } = createMemoryStorage();
  await records.commit({ operationId: "first", edits: [{ recordId: "note", replace: { title: "first" } }] });
  const saved = await records.commit({
    operationId: "second",
    edits: [{ recordId: "note", replace: { title: "second" } }],
  });
  expect(saved).toMatchObject({ operationId: "second", state: "saved-locally" });
  expect((await records.read("note")).value).toEqual({ title: "second" });
  expect((await records.outcome("first"))?.state).toBe("saved-locally");
});
