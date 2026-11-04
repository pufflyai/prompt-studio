import { expect, test } from "bun:test";
import { createMemoryStorageDevices } from "./index";

test("offline helper uses ordered whole values and atomic conditional refusal", async () => {
  const pair = await createMemoryStorageDevices();
  const [first, second] = pair.devices;
  await first.records.commit({
    operationId: "base",
    edits: [{ recordId: "note", replace: { body: "first\nlast", items: [1, 2], left: 0, right: 0 } }],
  });
  await pair.merge();
  const before = await second.records.read("note");
  await first.records.commit({
    operationId: "peer",
    edits: [{ recordId: "note", set: { "/body": "FIRST\nlast", "/items": [3], "/left": 1 } }],
  });
  await second.records.commit({
    operationId: "own",
    edits: [
      {
        recordId: "note",
        observedRevision: before.revision,
        replace: { body: "first\nLAST", items: [4], left: 0, right: 2 },
      },
    ],
  });
  await second.records.commit({
    operationId: "conditional",
    edits: [
      { recordId: "note", expectedRevision: before.revision, set: { "/left": 9 } },
      { recordId: "audit", replace: true },
    ],
  });
  await pair.merge();
  for (const storage of pair.devices) {
    expect((await storage.records.read("note")).value).toEqual({ body: "first\nLAST", items: [4], left: 1, right: 2 });
    expect((await storage.records.read("audit")).exists).toBe(false);
  }
  expect((await second.records.outcome("conditional"))?.state).toBe("refused");
  expect((await second.records.outcome("own"))?.state).toBe("synced");
});

test("declared text facade merges concurrent edits while undeclared text is rejected", async () => {
  const pair = await createMemoryStorageDevices({ textFields: [{ prefix: "note", fields: ["/body"] }] });
  const [first, second] = pair.devices;
  await first.records.commit({ operationId: "base", edits: [{ recordId: "note", replace: { body: "ab" } }] });
  await pair.merge();
  await first.text("note", "/body").edit([{ kind: "text.insert", index: 0, text: "L" }]);
  await second.text("note", "/body").edit([{ kind: "text.insert", index: 2, text: "R" }]);
  await pair.merge();
  for (const storage of pair.devices) expect((await storage.records.read("note")).value).toEqual({ body: "LabR" });
  await expect(first.text("note", "/plain").edit([{ kind: "text.insert", index: 0, text: "x" }])).rejects.toThrow(
    "declared",
  );
});

test("the helper resolves pending dependencies and refuses stale ABA observations atomically", async () => {
  const pair = await createMemoryStorageDevices();
  const [first, second] = pair.devices;
  await first.records.commit({ operationId: "parent", edits: [{ recordId: "note", replace: { count: 0 } }] });
  const pending = await first.records.read("note");
  await first.records.commit({
    operationId: "child",
    edits: [{ recordId: "note", expectedRevision: pending.revision, set: { "/count": 1 } }],
  });
  await pair.merge();
  expect((await first.records.outcome("child"))?.state).toBe("synced");
  expect(await second.records.outcome("child")).toBeUndefined();
  const before = await second.records.read("note");
  await first.records.commit({ operationId: "away", edits: [{ recordId: "note", set: { "/count": 2 } }] });
  await first.records.commit({ operationId: "back", edits: [{ recordId: "note", set: { "/count": 1 } }] });
  await second.records.commit({
    operationId: "stale",
    edits: [
      { recordId: "note", expectedRevision: before.revision, set: { "/count": 9 } },
      { recordId: "audit", replace: "atomic" },
    ],
  });
  await pair.merge();
  expect((await second.records.outcome("stale"))?.state).toBe("refused");
  for (const storage of pair.devices) {
    expect((await storage.records.read("note")).value).toEqual({ count: 1 });
    expect((await storage.records.read("audit")).exists).toBe(false);
  }
});

test("legacy collection lists omit deleted items before and after device sync", async () => {
  const pair = await createMemoryStorageDevices();
  const [first] = pair.devices;
  for (const [id, value] of [
    ["removed", "old"],
    ["kept", "saved"],
  ] as const)
    await first.collection("migration-input").put(id, { value });
  await pair.merge();
  await first.collection("migration-input").delete("removed");
  expect(await first.collection("migration-input").list()).toEqual([{ value: "saved" }]);
  await pair.merge();
  for (const storage of pair.devices) {
    expect(await storage.collection("migration-input").get("removed")).toBeUndefined();
    expect(await storage.collection("migration-input").list()).toEqual([{ value: "saved" }]);
    expect((await storage.records.list()).every((record) => !record.deleted)).toBe(true);
  }
});
