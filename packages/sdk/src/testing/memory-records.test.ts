import { expect, test } from "bun:test";
import { createMemoryStorage } from "./memory-storage";

test("complete record addresses round-trip a grouped resolution across storage scopes", async () => {
  const storage = createMemoryStorage();
  const resource = storage.scope({ type: "resource", resource: { type: "example.note", id: "other" } });
  const firstId = storage.records.id("same");
  const secondId = resource.records.id("same");
  const bases = await Promise.all([storage.records.read(firstId), resource.records.read(secondId)]);
  const edits = (value: string) =>
    bases.map((record) => ({ recordId: record.recordId, expectedRevision: record.revision, replace: value }));
  await storage.records.commit({ operationId: "winner", edits: edits("first") });
  await resource.records.commit({ operationId: "branch", edits: edits("retained") });
  const inspected = await resource.records.inspect("branch");
  expect(new Set(inspected.expectedInputs.map((input) => input.recordId)).size).toBe(2);
  expect((await resource.records.conflicts())[0].recordIds).toEqual([firstId, secondId]);
  expect(
    (
      await storage.records.resolve({
        operationId: "choose",
        conflictId: inspected.conflictId,
        choose: "local",
        expectedInputs: inspected.expectedInputs,
        expectedConflicts: inspected.expectedConflicts,
        capturedOperationIds: inspected.capturedOperationIds,
      })
    ).status,
  ).toBe("saved-locally");
  expect((await storage.records.read(firstId)).value).toBe("retained");
  expect((await resource.records.read(secondId)).value).toBe("retained");
});

test("seeded extension test storage is ready before the first public or legacy read", async () => {
  const storage = createMemoryStorage({
    kv: { first: "one", second: "two" },
    collections: { notes: { a: { title: "Seeded" } } },
  });
  expect((await storage.records.read(storage.records.id("second"))).value).toBe("two");
  expect(await storage.get<string>("first")).toBe("one");
  expect(await storage.collection("notes").get("a")).toEqual({ title: "Seeded" });
});

test("public record groups protect two open callers and retain complete alternatives", async () => {
  const { records } = createMemoryStorage();
  const base = await records.read("note");
  const group = {
    operationId: "first",
    edits: [{ recordId: "note", expectedRevision: base.revision, replace: { title: "first" } }],
  };
  expect((await records.commit(group)).status).toBe("saved-locally");
  expect(
    (
      await records.commit({
        operationId: "second",
        edits: [
          { recordId: "note", expectedRevision: base.revision, replace: { title: "second" } },
          {
            recordId: "joined",
            expectedRevision: (await records.read("joined")).revision,
            shared: [{ kind: "text.insert", index: 0, text: "whole group" }],
          },
        ],
      })
    ).status,
  ).toBe("conflict");
  expect((await records.read("note")).value).toEqual({ title: "first" });
  expect((await records.read("joined")).exists).toBe(false);
  expect((await records.conflicts())[0].alternativeOperationIds).toContain("second");
  const inspected = await records.inspect("second");
  expect(inspected.alternatives[0].records[1].shared).toEqual({ kind: "text", value: "whole group" });
  expect(
    (
      await records.resolve({
        operationId: "resolution",
        conflictId: inspected.conflictId,
        choose: "local",
        expectedInputs: inspected.expectedInputs,
        expectedConflicts: inspected.expectedConflicts,
        capturedOperationIds: inspected.capturedOperationIds,
      })
    ).status,
  ).toBe("saved-locally");
  expect((await records.read("note")).value).toEqual({ title: "second" });
  expect((await records.list()).map((record) => record.recordId).sort()).toEqual(["joined", "note"]);
  expect((await records.outcome("resolution"))?.status).toBe("saved-locally");
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
