import { expect, test } from "bun:test";
import type { JsonValue } from "../extensions";
import { createMemoryStorageDevices } from "./index";

const save = (storage: Awaited<ReturnType<typeof createMemoryStorageDevices>>["devices"][number], value: JsonValue) =>
  storage.records.commit({ operationId: crypto.randomUUID(), edits: [{ recordId: "note", replace: value }] });

test("offline devices keep different fields, nested keys, list items and multiline edits without replacements", async () => {
  const pair = await createMemoryStorageDevices();
  const [first, second] = pair.devices;
  const base = {
    title: "Before",
    status: "ready",
    nested: { left: 1, right: 1 },
    items: [
      { id: "a", title: "A" },
      { id: "b", title: "B" },
    ],
    body: "first\nlast",
  };
  await save(first, base);
  expect(await pair.merge()).toEqual([]);
  await save(first, {
    ...base,
    title: "After",
    nested: { left: 2, right: 1 },
    items: [{ id: "a", title: "Edited A" }, base.items[1]],
    body: "FIRST\nlast",
  });
  await save(second, {
    ...base,
    status: "done",
    nested: { left: 1, right: 2 },
    items: [base.items[0], { id: "b", title: "Edited B" }],
    body: "first\nLAST",
  });
  expect(await pair.merge()).toEqual([]);
  for (const storage of pair.devices)
    expect((await storage.records.read("note")).value).toEqual({
      title: "After",
      status: "done",
      nested: { left: 2, right: 2 },
      items: [
        { id: "a", title: "Edited A" },
        { id: "b", title: "Edited B" },
      ],
      body: "FIRST\nLAST",
    });
});

test("same-field replacement names the path and the kept value in both merge orders", async () => {
  const pair = await createMemoryStorageDevices({ kv: { settings: { nested: { title: "Before" } } } });
  const [first, second] = pair.devices;
  await first.set("settings", { nested: { title: "Left" } });
  await second.set("settings", { nested: { title: "Right" } });
  const report = await pair.merge();
  const kept = await first.get<{ nested: { title: string } }>("settings");
  expect(await second.get<{ nested: { title: string } }>("settings")).toEqual(kept);
  const keptTitle = kept!.nested.title;
  expect(report).toEqual([
    {
      recordId: first.records.id("settings"),
      path: ["value", "nested", "title"],
      kept: keptTitle,
      replaced: keptTitle === "Left" ? "Right" : "Left",
    },
  ]);
  expect(await pair.merge()).toEqual([]);
  await first.set("settings", { nested: { title: "Sequential" } });
  expect(await pair.merge()).toEqual([]);
});

test("creating different channels of one record keeps both edits without replacements", async () => {
  const pair = await createMemoryStorageDevices();
  await save(pair.devices[0], { title: "First" });
  await pair.devices[1].records.commit({
    operationId: "shared",
    edits: [{ recordId: "note", shared: [{ kind: "map.set", key: "key", value: "Second" }] }],
  });
  expect(await pair.merge()).toEqual([]);
  for (const storage of pair.devices)
    expect(await storage.records.read("note")).toMatchObject({
      value: { title: "First" },
      shared: { kind: "map", value: { key: "Second" } },
    });
});

test("record deletion reports a concurrent addition of its first shared channel", async () => {
  const pair = await createMemoryStorageDevices();
  await save(pair.devices[0], { title: "Before" });
  await pair.merge();
  await pair.devices[0].records.commit({ operationId: "delete", edits: [{ recordId: "note", deleted: true }] });
  await pair.devices[1].records.commit({
    operationId: "shared",
    edits: [{ recordId: "note", shared: [{ kind: "map.set", key: "key", value: "Lost" }] }],
  });
  expect(await pair.merge()).toEqual([
    { recordId: "note", path: ["shared"], kept: undefined, replaced: { kind: "map", value: { key: "Lost" } } },
  ]);
  for (const storage of pair.devices) expect((await storage.records.read("note")).deleted).toBe(true);
});

test("an explicit null competes with a value when both devices create a record", async () => {
  const pair = await createMemoryStorageDevices();
  await save(pair.devices[0], null);
  await save(pair.devices[1], "Other");
  const report = await pair.merge();
  const kept = (await pair.devices[0].records.read("note")).value;
  expect(report).toEqual([{ recordId: "note", path: ["value"], kept, replaced: kept === null ? "Other" : null }]);
});

test("concurrent creation reports only competing fields and keeps unrelated keys", async () => {
  const pair = await createMemoryStorageDevices();
  await save(pair.devices[0], { same: "Left", left: true });
  await save(pair.devices[1], { same: "Right", right: true });
  const report = await pair.merge();
  const value = (await pair.devices[0].records.read("note")).value as { same: string };
  expect(report).toEqual([
    { recordId: "note", path: ["value", "same"], kept: value.same, replaced: value.same === "Left" ? "Right" : "Left" },
  ]);
  expect((await pair.devices[1].records.read("note")).value).toEqual({ same: value.same, left: true, right: true });
});

test("resource scopes share device identity while separate helpers stay isolated", async () => {
  const pair = await createMemoryStorageDevices();
  const scope = { type: "resource" as const, resource: { type: "note", id: "a" } };
  await pair.devices[0].scope(scope).set("title", "Scoped");
  await pair.merge();
  expect(await pair.devices[1].scope(scope).get<string>("title")).toBe("Scoped");
  expect(await pair.devices[1].get("title")).toBeUndefined();
  expect(await (await createMemoryStorageDevices()).devices[0].scope(scope).get("title")).toBeUndefined();
});

test("deletion replaces a concurrent edit and null remains distinct from a removed value", async () => {
  const pair = await createMemoryStorageDevices({ kv: { setting: { title: "Before" } } });
  await pair.devices[0].delete("setting");
  await pair.devices[1].set("setting", { title: "Edited" });
  expect(await pair.merge()).toEqual([
    {
      recordId: pair.devices[0].records.id("setting"),
      path: ["value"],
      kept: undefined,
      replaced: { title: "Edited" },
    },
  ]);
  for (const storage of pair.devices) expect(await storage.get("setting")).toBeUndefined();
  await save(pair.devices[0], { field: "Before" });
  await pair.merge();
  await save(pair.devices[0], { field: null });
  await save(pair.devices[1], {});
  const report = await pair.merge();
  const value = (await pair.devices[0].records.read("note")).value as { field?: null };
  expect(report).toEqual([
    {
      recordId: "note",
      path: ["value", "field"],
      kept: value.field,
      replaced: value.field === null ? undefined : null,
    },
  ]);
});

test("list diagnostics match items by identity across moves and report competing fields", async () => {
  const pair = await createMemoryStorageDevices();
  const [first, second] = pair.devices;
  const a = { id: "a", title: "A" };
  const b = { id: "b", title: "B" };
  await save(first, [a, b]);
  await pair.merge();
  await save(first, [b, { ...a, title: "Left" }, { id: "c", title: "C" }]);
  await save(second, [{ ...a, title: "Right" }, b, { id: "d", title: "D" }]);
  const report = await pair.merge();
  const values = (await first.records.read("note")).value as { id: string; title: string }[];
  const index = values.findIndex((item) => item.id === "a");
  expect(report).toEqual([
    {
      recordId: "note",
      path: ["value", index, "title"],
      kept: values[index].title,
      replaced: values[index].title === "Left" ? "Right" : "Left",
    },
  ]);
  expect(new Set(values.map((item) => item.id))).toEqual(new Set(["a", "b", "c", "d"]));
  expect((await second.records.read("note")).value).toEqual(values);
});

test("removing an identified list item reports the concurrent edit it hid", async () => {
  const pair = await createMemoryStorageDevices();
  const [first, second] = pair.devices;
  await save(first, [{ id: "a", title: "A" }]);
  await pair.merge();
  await save(first, []);
  await save(second, [{ id: "a", title: "Edited" }]);
  expect(await pair.merge()).toEqual([
    { recordId: "note", path: ["value", 0], kept: undefined, replaced: { id: "a", title: "Edited" } },
  ]);
});

test("collection fixtures are forked once and offline migrations agree", async () => {
  const pair = await createMemoryStorageDevices({ collections: { notes: { a: { title: "Seeded", body: "Before" } } } });
  const [first, second] = pair.devices;
  await first.collection("notes").update("a", { title: "Edited", body: "Before" });
  await second.collection("notes").update("a", { title: "Seeded", body: "After" });
  expect(await pair.merge()).toEqual([]);
  for (const storage of pair.devices)
    expect(await storage.collection("notes").get("a")).toEqual({ title: "Edited", body: "After" });
  for (const storage of pair.devices) await storage.migrate(1, () => storage.set("migrated", { ready: true }));
  expect(await pair.merge()).toEqual([]);
  let rerun = false;
  await second.migrate(1, async () => {
    rerun = true;
  });
  expect(rerun).toBe(false);
});

test("the devices share migration identities while keeping random IDs and order positions distinct", async () => {
  const pair = await createMemoryStorageDevices({ workbenchId: "shared", extensionId: "notes", deviceId: "first" });
  const ids: string[] = [];
  for (const storage of pair.devices) {
    await storage.migrate(1, async (_, migration) => {
      const id = migration.id("source", "nt");
      ids.push(id);
      await storage.records.commit({ operationId: id, edits: [{ recordId: id, replace: { title: "Imported" } }] });
    });
  }
  expect(ids[0]).toBe(ids[1]);
  expect(await pair.merge()).toEqual([]);
  for (const storage of pair.devices) expect(await storage.records.list()).toHaveLength(1);
  expect(pair.devices[0].ids.create()).not.toBe(pair.devices[1].ids.create());
  expect(pair.devices[0].positions.between()).not.toBe(pair.devices[1].positions.between());
});
