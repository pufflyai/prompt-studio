import { expect, test } from "bun:test";
import { createMemoryStorage } from "./memory-storage";

test("memory storage keeps data migration versions in their storage scope", async () => {
  const storage = createMemoryStorage();
  const migrate = (scope: typeof storage) =>
    scope.migrate(1, async (previous) => {
      expect(previous).toBe(0);
      await scope.set("value", "migrated");
    });
  await migrate(storage);
  expect((await storage.records.read(storage.records.id("value"))).value).toBe("migrated");
  const resource = storage.scope({ type: "resource", resource: { type: "note", id: "one" } });
  expect(await resource.get<string>("value")).toBeUndefined();
  await migrate(resource);
  await storage.scope({ type: "resource", resource: { type: "note", id: "one" } }).migrate(1, async () => {
    throw new Error("Must run once per scope");
  });
  expect(await resource.get<string>("value")).toBe("migrated");
  expect((await resource.records.read(resource.records.id("value"))).value).toBe("migrated");
});

test("memory storage exposes retained-data fixtures without exposing mutable source records", async () => {
  const legacy = { version: "old-schema", records: [{ project_id: "project", name: "custom" }] };
  const storage = createMemoryStorage({ legacyData: { old_notes: legacy } });
  const imported = await storage.readLegacy("old_notes");
  expect(imported).toEqual(legacy);
  imported!.records[0].name = "edited";
  expect(await storage.readLegacy("old_notes")).toEqual(legacy);
  expect(await storage.readLegacy("unknown")).toBeUndefined();
});
