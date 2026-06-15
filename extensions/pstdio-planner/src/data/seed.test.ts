import { describe, expect, test } from "bun:test";
import { statusesCollection, tagsCollection } from "./collections";
import { createMemoryStorage } from "./memory-storage";
import { DEFAULT_STATUSES, DEFAULT_TAGS, seedDefaultStatuses, seedDefaultTags } from "./seed";

describe("seedDefaultStatuses", () => {
  test("creates the default board columns with ids", async () => {
    const storage = createMemoryStorage();

    const created = await seedDefaultStatuses(storage);

    expect(created).toHaveLength(DEFAULT_STATUSES.length);
    expect(created.map((status) => status.name)).toEqual(DEFAULT_STATUSES.map((status) => status.name));
    for (const status of created) expect(status.id).toBeTruthy();

    const stored = await statusesCollection(storage).list();
    expect(stored).toHaveLength(DEFAULT_STATUSES.length);
    expect(stored.every((status) => Boolean(status.id))).toBe(true);
  });

  test("matches the legacy default board status set", () => {
    expect(
      DEFAULT_STATUSES.map((status) => ({
        name: status.name,
        color: status.color,
        isDefault: status.isDefault,
      })),
    ).toEqual([
      { name: "Backlog", color: "gray", isDefault: true },
      { name: "Ready", color: "green", isDefault: false },
      { name: "In Progress", color: "blue", isDefault: false },
      { name: "Blocked", color: "red", isDefault: false },
      { name: "In Review", color: "yellow", isDefault: false },
      { name: "Done", color: "green", isDefault: false },
    ]);
  });

  test("is idempotent — does not duplicate on re-run", async () => {
    const storage = createMemoryStorage();

    await seedDefaultStatuses(storage);
    const second = await seedDefaultStatuses(storage);

    const stored = await statusesCollection(storage).list();
    expect(stored).toHaveLength(DEFAULT_STATUSES.length);
    expect(second).toHaveLength(DEFAULT_STATUSES.length);
  });

  test("does not duplicate defaults when seeded concurrently", async () => {
    const storage = createMemoryStorage();

    await Promise.all([seedDefaultStatuses(storage), seedDefaultStatuses(storage)]);

    const stored = await statusesCollection(storage).list();
    expect(stored).toHaveLength(DEFAULT_STATUSES.length);
  });

  test("completes a partial default seed before the seeded marker is written", async () => {
    const storage = createMemoryStorage();
    await statusesCollection(storage).put(DEFAULT_STATUSES[0].id, DEFAULT_STATUSES[0]);

    const seeded = await seedDefaultStatuses(storage);

    expect(seeded.map((status) => status.id)).toEqual(DEFAULT_STATUSES.map((status) => status.id));
  });

  test("does not recreate deleted defaults after seeding completed", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);

    await statusesCollection(storage).delete(DEFAULT_STATUSES[0].id);
    const seeded = await seedDefaultStatuses(storage);

    expect(seeded.map((status) => status.id)).not.toContain(DEFAULT_STATUSES[0].id);
  });

  test("exposes exactly one default status", () => {
    expect(DEFAULT_STATUSES.filter((status) => status.isDefault)).toHaveLength(1);
  });

  test("uses circle icons for every default status", () => {
    expect(DEFAULT_STATUSES.map((status) => status.icon ?? null)).toEqual(DEFAULT_STATUSES.map(() => null));
  });
});

describe("seedDefaultTags", () => {
  test("does not duplicate defaults when seeded concurrently", async () => {
    const storage = createMemoryStorage();

    await Promise.all([seedDefaultTags(storage), seedDefaultTags(storage)]);

    const stored = await tagsCollection(storage).list();
    expect(stored.map((tag) => tag.name)).toEqual(["Priority", "Type", "Complexity"]);
    expect(stored.find((tag) => tag.id === "default-type")?.type).toBe("single_select");
  });

  test("completes a partial default seed before the seeded marker is written", async () => {
    const storage = createMemoryStorage();
    const first = DEFAULT_TAGS[0]();
    await tagsCollection(storage).put(first.id, first);

    const seeded = await seedDefaultTags(storage);

    expect(first.id).toBe("default-priority");
    expect(seeded.map((tag) => tag.id)).toEqual(["default-priority", "default-type", "default-complexity"]);
  });

  test("uses circle icons for the default complexity options", () => {
    const complexity = DEFAULT_TAGS.map((seed) => seed()).find((tag) => tag.id === "default-complexity");

    expect(complexity?.options.map((option) => option.icon ?? null)).toEqual([null, null, null]);
  });
});
