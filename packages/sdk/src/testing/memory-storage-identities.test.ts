import { expect, test } from "bun:test";
import { createMemoryStorage } from "./memory-storage";

test("two devices import the same source records with the same migration IDs", async () => {
  const devices = [createMemoryStorage({ workbenchId: "shared" }), createMemoryStorage({ workbenchId: "shared" })];
  const imported = await Promise.all(
    devices.map(async (storage) => {
      const ids: string[] = [];
      await storage.migrate(1, async (_, migration) => {
        for (const key of ["one", "two"]) {
          const id = migration.id(key);
          expect(migration.id(key)).toBe(id);
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

test("memory storage creates random time-ordered IDs and distinct concurrent positions", async () => {
  const first = createMemoryStorage();
  const second = createMemoryStorage();
  const id = first.ids.create();
  await Bun.sleep(2);
  expect(first.ids.create() > id).toBe(true);
  expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  const concurrent = [first.positions.between(), second.positions.between()].sort();
  expect(concurrent[0]).not.toBe(concurrent[1]);
  const middle = first.positions.between(concurrent[0], concurrent[1]);
  expect(concurrent[0]! < middle && middle < concurrent[1]!).toBe(true);
});
