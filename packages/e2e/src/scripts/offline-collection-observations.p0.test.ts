import { expect, test } from "bun:test";
import { createMemoryStorageDevices } from "@pstdio/sdk/testing";

test("locally accepted collection edits keep independent offline fields when timestamps overlap", async () => {
  const pair = await createMemoryStorageDevices({
    collections: { tickets: { a: { title: "Original", track: "api", updatedAt: "before" } } },
  });
  const first = pair.devices[0].collection<{ title: string; track: string; updatedAt: string }>("tickets");
  const second = pair.devices[1].collection<{ title: string; track: string; updatedAt: string }>("tickets");
  const left = (await first.read("a"))!;
  const right = (await second.read("a"))!;
  expect(await first.updateIfUnchanged("a", left.revision, { ...left.value, title: "Edited", updatedAt: "left" })).toBe(
    true,
  );
  expect(await second.updateIfUnchanged("a", right.revision, { ...right.value, track: "ui", updatedAt: "right" })).toBe(
    true,
  );
  await pair.merge();
  for (const collection of [first, second])
    expect(await collection.get("a")).toEqual({ title: "Edited", track: "ui", updatedAt: "right" });
});

test("an offline collection edit cannot change a deleted and recreated lifetime", async () => {
  const pair = await createMemoryStorageDevices({
    collections: { tickets: { a: { title: "Original", marker: "old" } } },
  });
  const first = pair.devices[0].collection<{ title: string; marker: string }>("tickets");
  const second = pair.devices[1].collection<{ title: string; marker: string }>("tickets");
  const observed = (await second.read("a"))!;
  await first.delete("a");
  await first.put("a", { title: "Replacement", marker: "new" });
  expect(await second.updateIfUnchanged("a", observed.revision, { ...observed.value, title: "Stale edit" })).toBe(true);
  await pair.merge();
  for (const collection of [first, second])
    expect(await collection.get("a")).toEqual({ title: "Replacement", marker: "new" });
});
