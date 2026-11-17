import { expect, test } from "bun:test";
import type { ExtensionStorageApi } from "pstdio-api-contracts/extension-kernel";
import { createMemoryStorage } from "./memory-storage";
import { createMemoryStorageDevices } from "./memory-storage-devices";

const moveTickets = (storage: ExtensionStorageApi) =>
  storage.migrate(1, async (_previous, migration) => {
    await migration.moveCollection("tickets", { keyPrefix: "ticket:" });
  });

test("moveCollection unwraps items into records and the collection API keeps working", async () => {
  const storage = createMemoryStorage();
  const tickets = storage.collection<{ title: string }>("tickets");
  await tickets.put("a", { title: "A" });
  await tickets.put("b", { title: "B" });
  let moved: { moved: number } | undefined;
  await storage.migrate(1, async (_previous, migration) => {
    moved = await migration.moveCollection("tickets", { keyPrefix: "ticket:" });
  });

  expect(moved).toEqual({ moved: 2 });
  expect((await storage.records.read(storage.records.id("ticket:a"))).value).toEqual({ title: "A" });
  expect(await tickets.get("a")).toEqual({ title: "A" });
  await tickets.put("c", { title: "C" });
  expect((await storage.records.read(storage.records.id("ticket:c"))).value).toEqual({ title: "C" });
  expect(await tickets.list()).toEqual([{ title: "A" }, { title: "B" }, { title: "C" }]);
});

test("moveCollection is only valid while its migration runs", async () => {
  const storage = createMemoryStorage();
  let escaped: Parameters<Parameters<ExtensionStorageApi["migrate"]>[1]>[1] | undefined;
  await storage.migrate(1, async (_previous, migration) => {
    escaped = migration;
  });
  expect(() => escaped!.moveCollection("tickets", { keyPrefix: "ticket:" })).toThrow("only valid while");
});

test("an offline device's old-format write after the move ends up on the moved record", async () => {
  const { devices, merge } = await createMemoryStorageDevices();
  const [mover, offline] = devices;
  await mover.collection("tickets").put("a", { title: "A" });
  await merge();

  await moveTickets(mover);
  await offline.collection("tickets").update("a", { title: "A offline" });
  await merge();
  // The offline write was refused at the old address; its author saved it again on the record.
  await merge();

  expect((await mover.records.read(mover.records.id("ticket:a"))).value).toEqual({ title: "A offline" });
  expect(await offline.collection("tickets").get("a")).toEqual({ title: "A offline" });
  expect((await offline.records.read(offline.records.id("ticket:a"))).value).toEqual({ title: "A offline" });
});

test("a move that missed a concurrent edit runs again and keeps the edit", async () => {
  const { devices, merge } = await createMemoryStorageDevices();
  const [editor, mover] = devices;
  await editor.collection("tickets").put("a", { title: "A" });
  await merge();

  // Relay order admits the first device's save first, so the move observed a stale item.
  await editor.collection("tickets").update("a", { title: "A edited" });
  await moveTickets(mover);
  await merge();
  await merge();

  for (const storage of devices) {
    expect((await storage.records.read(storage.records.id("ticket:a"))).value).toEqual({ title: "A edited" });
    expect(await storage.collection("tickets").get("a")).toEqual({ title: "A edited" });
  }
});

test("a key prefix index returns the same pages after the move as the collection index did before", async () => {
  const storage = createMemoryStorage();
  const tickets = storage.collection<{ title: string; rank: number }>("tickets");
  for (const [id, rank] of [
    ["a", 3],
    ["b", 1],
    ["c", 2],
  ] as const)
    await tickets.put(id, { title: id.toUpperCase(), rank });
  const fields = {
    rank: { path: ["rank"], type: "number" as const },
    title: { path: ["title"], type: "string" as const },
  };
  const page = async () =>
    (await storage.records.query({ index: "tickets", limit: 2 })).records.map((record) => record.fields);
  await storage.records.defineIndexes([
    { name: "tickets", collection: "tickets", fields, orderBy: [{ field: "rank", direction: "asc" }] },
  ]);
  const before = await page();

  await moveTickets(storage);
  await storage.records.defineIndexes([
    { name: "tickets", keyPrefix: "ticket:", fields, orderBy: [{ field: "rank", direction: "asc" }] },
  ]);

  expect(before).toEqual([
    { rank: 1, title: "B" },
    { rank: 2, title: "C" },
  ]);
  expect(await page()).toEqual(before);
});

test("list keeps one entry per item when an item stays in place because its target is taken", async () => {
  const storage = createMemoryStorage();
  const tickets = storage.collection<{ title: string }>("tickets");
  await tickets.put("b", { title: "B" });
  await moveTickets(storage);
  // An item that could not move: a record already sits at its target address.
  const legacy = JSON.stringify([...JSON.parse(storage.records.id("x")).slice(0, 2), "collection", "tickets", "a"]);
  await storage.records.commit({
    operationId: crypto.randomUUID(),
    edits: [
      { recordId: legacy, replace: { value: { title: "A in place" }, sortOrder: null } },
      { recordId: storage.records.id("ticket:a"), replace: { title: "Other record" } },
    ],
  });

  expect(await tickets.list()).toEqual([{ title: "A in place" }, { title: "B" }]);
  expect(await tickets.get("a")).toEqual({ title: "A in place" });
});
