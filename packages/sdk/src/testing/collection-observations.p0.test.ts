import { expect, test } from "bun:test";
import { createMemoryStorageDevices } from "./memory-storage-devices";

test("a collection metadata update preserves a remote edit received after its read", async () => {
  const pair = await createMemoryStorageDevices();
  const first = pair.devices[0].collection<{ title: string; position?: string }>("tickets");
  const second = pair.devices[1].collection<{ title: string; position?: string }>("tickets");
  await first.put("a", { title: "Original" });
  await pair.merge();
  const observed = (await first.read("a"))!;
  await second.update("a", { title: "Remote user edit" });
  await pair.merge();
  expect(
    await first.updateIfUnchanged("a", observed.revision, { ...observed.value, position: "imported-position" }),
  ).toBe(false);
  const latest = (await first.read("a"))!;
  expect(await first.updateIfUnchanged("a", latest.revision, { ...latest.value, position: "imported-position" })).toBe(
    true,
  );
  await pair.merge();
  for (const storage of pair.devices)
    expect(await storage.collection("tickets").get("a")).toEqual({
      title: "Remote user edit",
      position: "imported-position",
    });
});

test("an observed collection update cannot restore a record deleted after the read", async () => {
  const pair = await createMemoryStorageDevices();
  const first = pair.devices[0].collection<{ title: string }>("tickets");
  await first.put("a", { title: "Original" });
  await pair.merge();
  const observed = (await first.read("a"))!;
  await pair.devices[1].collection("tickets").delete("a");
  await pair.merge();
  expect(await first.updateIfUnchanged("a", observed.revision, { title: "Changed" })).toBe(false);
  expect(await first.read("a")).toBeUndefined();
});

test("competing conditional collection updates cannot both replace one observed value", async () => {
  const pair = await createMemoryStorageDevices();
  const collection = pair.devices[0].collection<{ title: string }>("tickets");
  await collection.put("a", { title: "Original" });
  const observed = (await collection.read("a"))!;
  const results = await Promise.all([
    collection.updateIfUnchanged("a", observed.revision, { title: "First" }),
    collection.updateIfUnchanged("a", observed.revision, { title: "Second" }),
  ]);
  expect(results.filter(Boolean)).toHaveLength(1);
  expect((await collection.get("a"))!.title).toBe(results[0] ? "First" : "Second");
});

test("recreating identical collection data invalidates the previous lifetime's observation", async () => {
  const pair = await createMemoryStorageDevices();
  const collection = pair.devices[0].collection<{ title: string }>("tickets");
  await collection.put("a", { title: "Original" });
  const observed = (await collection.read("a"))!;
  await collection.delete("a");
  await collection.put("a", { title: "Original" });
  expect(await collection.updateIfUnchanged("a", observed.revision, { title: "Stale edit" })).toBe(false);
  expect(await collection.get("a")).toEqual({ title: "Original" });
});
