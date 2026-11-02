import { expect, test } from "bun:test";
import type { Json } from "pstdio-sync-contracts";
import * as Y from "yjs";
import { memoryDocumentState } from "../shared/document-types";
import { createDocumentStorage } from "./document-storage";

const owner = { workbenchId: "project", extensionId: "notes" };
const device = (source?: Y.Doc) => {
  const document = new Y.Doc();
  if (source) Y.applyUpdate(document, Y.encodeStateAsUpdate(source));
  const state = memoryDocumentState(document);
  const storage = createDocumentStorage({
    owner,
    store: { transaction: async (_owner, action) => action(state) },
  });
  const save = (value: Json, recordId = "note") =>
    storage.records.commit({
      operationId: crypto.randomUUID(),
      edits: [{ recordId, replace: value }],
    });
  return { document, ...storage, save };
};
const merge = (...devices: ReturnType<typeof device>[]) => {
  const updates = devices.map(({ document }) => Y.encodeStateAsUpdate(document));
  for (const { document } of devices) for (const update of [...updates].reverse()) Y.applyUpdate(document, update);
};

test("offline ticket field, nested key, list item and multiline text edits merge on both devices", async () => {
  const first = device();
  const base = {
    title: "Before",
    status: "ready",
    nested: { left: 1, right: 1 },
    items: [
      { id: "a", title: "A", checked: false },
      { id: "b", title: "B", checked: false },
    ],
    body: "first line\nmiddle line\nlast line",
  };
  await first.save(base);
  const second = device(first.document);
  await first.save({
    ...base,
    title: "After",
    nested: { left: 2, right: 1 },
    items: [{ ...base.items[0], title: "Edited A" }, base.items[1]],
    body: "FIRST line\nmiddle line\nlast line",
  });
  await second.save({
    ...base,
    status: "done",
    nested: { left: 1, right: 2 },
    items: [base.items[0], { ...base.items[1], checked: true }],
    body: "first line\nmiddle line\nLAST line",
  });
  merge(first, second);
  const expected = {
    title: "After",
    status: "done",
    nested: { left: 2, right: 2 },
    items: [
      { id: "a", title: "Edited A", checked: false },
      { id: "b", title: "B", checked: true },
    ],
    body: "FIRST line\nmiddle line\nLAST line",
  };
  expect((await first.records.read("note")).value).toEqual(expected);
  expect((await second.records.read("note")).value).toEqual(expected);
});

test("concurrent list additions, removals and moves retain each distinct item once", async () => {
  const first = device();
  await first.save(["a", "b", "c", "d"]);
  const second = device(first.document);
  await first.save(["c", "a", "b", "x"]);
  await second.save(["a", "c", "b", "d", "x", "y"]);
  merge(first, second);
  const values = (await first.records.read("note")).value as string[];
  expect(new Set(values)).toEqual(new Set(["a", "b", "c", "x", "y"]));
  expect(values).toHaveLength(5);
  expect((await second.records.read("note")).value).toEqual(values);
});

test("deleting a record or an identified list item wins over a concurrent nested edit", async () => {
  const first = device();
  await first.save({ title: "Before" });
  await first.save(
    [
      { id: "a", title: "A" },
      { id: "b", title: "B" },
    ],
    "list",
  );
  const second = device(first.document);
  await first.records.commit({ operationId: "delete", edits: [{ recordId: "note", deleted: true }] });
  await first.save([{ id: "b", title: "B" }], "list");
  await second.save({ title: "Edited offline" });
  await second.save(
    [
      { id: "a", title: "Edited offline" },
      { id: "b", title: "B" },
    ],
    "list",
  );
  merge(first, second);
  for (const storage of [first, second]) {
    expect(await storage.records.read("note")).toMatchObject({ exists: true, deleted: true });
    expect((await storage.records.read("list")).value).toEqual([{ id: "b", title: "B" }]);
  }
});

test("a multi-record commit is one update and retrying it does not overwrite later edits", async () => {
  const first = device();
  const updates: Uint8Array[] = [];
  first.document.on("update", (update) => updates.push(update));
  const group = {
    operationId: "together",
    edits: [
      { recordId: "one", replace: { title: "First" } },
      { recordId: "two", replace: { title: "Second" } },
    ],
  };
  await first.records.commit(group);
  expect(updates).toHaveLength(1);
  const second = device();
  Y.applyUpdate(second.document, updates[0]);
  expect(await second.records.list()).toHaveLength(2);
  await first.save({ title: "Later" }, "one");
  await first.records.commit(group);
  expect((await first.records.read("one")).value).toEqual({ title: "Later" });
});

test("concurrent creation merges keys of new records and new nested objects", async () => {
  const first = device();
  const second = device();
  await first.save({ nested: { left: 1 } });
  await second.save({ nested: { right: 2 } });
  merge(first, second);
  expect((await first.records.read("note")).value).toEqual({ nested: { left: 1, right: 2 } });
  expect((await second.records.read("note")).value).toEqual({ nested: { left: 1, right: 2 } });
});

test("two devices promoting a single line to text keep the common characters once", async () => {
  const first = device();
  await first.save("base");
  const second = device(first.document);
  await first.save("base\nleft");
  await second.save("base\nright");
  merge(first, second);
  const value = (await first.records.read("note")).value as string;
  expect(value.match(/base/g)).toHaveLength(1);
  expect(value).toContain("left");
  expect(value).toContain("right");
  expect((await second.records.read("note")).value).toBe(value);
});

test("an invalid later edit leaves every record and operation unsaved", async () => {
  const first = device();
  await expect(
    first.records.commit({
      operationId: "invalid",
      edits: [
        { recordId: "one", replace: true },
        { recordId: "two", shared: [{ kind: "text.delete", index: -1, count: 3 }] },
      ],
    }),
  ).rejects.toThrow();
  expect(await first.records.list()).toEqual([]);
  expect(await first.records.outcome("invalid")).toBeUndefined();
});

test("accepted text has the same Unicode values and keys before and after serialization", async () => {
  const first = device();
  await first.save({
    title: "a\ud800b",
    "\udc00key": { lines: "one\n\ud800", values: ["😀", "\udc00", "\u0000"] },
  });
  await first.records.commit({
    operationId: "shared-unicode",
    edits: [
      { recordId: "map", shared: [{ kind: "map.set", key: "\ud800key", value: ["\udc00"] }] },
      { recordId: "text", shared: [{ kind: "text.insert", index: 0, text: "\ud800\n😀" }] },
      { recordId: "list", shared: [{ kind: "list.insert", index: 0, values: [{ "\ud800": "\udc00" }] }] },
    ],
  });
  const second = device(first.document);
  expect((await first.records.read("note")).value).toEqual({
    title: "a�b",
    "�key": { lines: "one\n�", values: ["😀", "�", "\u0000"] },
  });
  expect(await first.records.list()).toEqual(await second.records.list());
  await first.records.commit({
    operationId: "delete-normalized-key",
    edits: [{ recordId: "map", shared: [{ kind: "map.delete", key: "\ud800key" }] }],
  });
  expect((await first.records.read("map")).shared?.value).toEqual({});
  first.document.destroy();
  second.document.destroy();
});
