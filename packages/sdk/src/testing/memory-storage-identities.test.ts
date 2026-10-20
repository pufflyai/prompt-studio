import { expect, test } from "bun:test";
import { createMemoryStorage } from "./memory-storage";

test("two devices import the same source records with the same migration IDs", async () => {
  const devices = [createMemoryStorage({ workbenchId: "shared" }), createMemoryStorage({ workbenchId: "shared" })];
  const imported = await Promise.all(
    devices.map(async (storage) => {
      const ids: string[] = [];
      await storage.migrate(1, async (_, migration) => {
        for (const key of ["one", "two"]) {
          const id = migration.id(key, "nt");
          expect(id).toMatch(/^nt_[0-9A-Za-z]{22}$/);
          expect(migration.id(key, "nt")).toBe(id);
          ids.push(id);
          await storage.records.commit({ operationId: id, edits: [{ recordId: id, replace: { key } }] });
        }
      });
      expect((await storage.records.list()).map((record) => record.recordId).sort()).toEqual([...ids].sort());
      return ids;
    }),
  );
  expect(imported[0]).toEqual(imported[1]);
  expect(imported[0]![0]).not.toBe(imported[0]![1]);
});

test("migration IDs separate versions and scopes and stay stable after a failed attempt", async () => {
  const storage = createMemoryStorage();
  let first = "";
  await expect(
    storage.migrate(1, async (_, migration) => {
      first = migration.id("source");
      throw new Error("Interrupted");
    }),
  ).rejects.toThrow("Interrupted");
  await storage.migrate(1, async (_, migration) => {
    expect(migration.id("source")).toBe(first);
    expect(storage.ids.create()).not.toBe(first);
  });
  await storage.migrate(2, async (_, migration) => {
    expect(migration.id("source")).not.toBe(first);
  });
  await storage.scope({ type: "custom", id: "other" }).migrate(1, async (_, migration) => {
    expect(migration.id("source")).not.toBe(first);
  });
});

test("existing UUIDs and case-distinct compact IDs remain separate record identities", async () => {
  const storage = createMemoryStorage();
  const ids = ["7d3c8b35-62f1-4b72-9714-1f697d843a20", "tk_00egMz01XBDRok8fF", "tk_00egMz01XBDRok8ff"];
  await storage.records.commit({
    operationId: storage.ids.create("op"),
    edits: ids.map((recordId) => ({ recordId, replace: { original: recordId } })),
  });
  expect((await storage.records.list()).map(({ recordId }) => recordId).sort()).toEqual([...ids].sort());
  for (const id of ids) expect((await storage.records.read(id)).value).toEqual({ original: id });
});

test("memory storage creates random time-ordered IDs and distinct concurrent positions", async () => {
  const first = createMemoryStorage();
  const second = createMemoryStorage();
  const id = first.ids.create("nt");
  await Bun.sleep(2);
  expect(first.ids.create("nt") > id).toBe(true);
  expect(id).toMatch(/^nt_[0-9A-Za-z]{22}$/);
  const concurrent = [first.positions.between(), second.positions.between()].sort();
  expect(concurrent[0]).not.toBe(concurrent[1]);
  const middle = first.positions.between(concurrent[0], concurrent[1]);
  expect(concurrent[0]! < middle && middle < concurrent[1]!).toBe(true);
});
