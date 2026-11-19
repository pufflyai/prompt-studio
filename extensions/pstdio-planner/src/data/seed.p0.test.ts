import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { sortedBySortOrder } from "../utils/sort";
import { statusesCollection, tagsCollection } from "./collections";
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
});

describe("seedDefaultTags", () => {
  test("does not duplicate defaults when seeded concurrently", async () => {
    const storage = createMemoryStorage();

    await Promise.all([seedDefaultTags(storage), seedDefaultTags(storage)]);

    const stored = sortedBySortOrder(await tagsCollection(storage).list());
    expect(stored.map((tag) => tag.name)).toEqual(["Priority", "Type", "Complexity"]);
    expect(stored.find((tag) => tag.id === "default-type")?.type).toBe("single_select");
  });

  test("completes a partial tag seed without replacing customized records", async () => {
    const storage = createMemoryStorage();
    const priority = DEFAULT_TAGS[0]();
    const customized = {
      ...priority,
      name: "Urgency",
      options: priority.options.map((option) => ({ ...option, color: "purple", icon: "star" })),
    };
    await tagsCollection(storage).put(customized.id, customized);

    const results = await Promise.all([seedDefaultTags(storage), seedDefaultTags(storage)]);

    expect(results[0].map((tag) => tag.id)).toEqual(["default-priority", "default-type", "default-complexity"]);
    for (const seeded of results) expect(seeded.find((tag) => tag.id === customized.id)).toEqual(customized);
    expect(await tagsCollection(storage).get(customized.id)).toEqual(customized);
    expect(sortedBySortOrder(await seedDefaultTags(storage))).toEqual(results[0]);
  });
});
