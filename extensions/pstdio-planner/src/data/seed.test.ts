import { describe, expect, test } from "bun:test";
import { statusesCollection, tagsCollection } from "./collections";
import { createMemoryStorage } from "./memory-storage";
import { DEFAULT_STATUSES, DEFAULT_TAGS, HUMAN_REQUESTED_TAG, seedDefaultStatuses, seedDefaultTags } from "./seed";

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

  test("matches the default board status set", () => {
    expect(
      DEFAULT_STATUSES.map((status) => ({
        name: status.name,
        color: status.color,
        isDefault: status.isDefault,
      })),
    ).toEqual([
      { name: "Backlog", color: "gray", isDefault: true },
      { name: "Todo", color: "purple", isDefault: false },
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

  test("draws every default status with a status ring glyph", () => {
    expect(DEFAULT_STATUSES.map((status) => status.icon)).toEqual([
      "status-backlog",
      "status-todo",
      "status-progress",
      "status-canceled",
      "status-review",
      "status-done",
    ]);
  });
});

describe("seedDefaultTags", () => {
  test("does not duplicate defaults when seeded concurrently", async () => {
    const storage = createMemoryStorage();

    await Promise.all([seedDefaultTags(storage), seedDefaultTags(storage)]);

    const stored = await tagsCollection(storage).list();
    expect(stored.map((tag) => tag.name)).toEqual(["Priority", "Type", "Complexity", "Flags"]);
    expect(stored.find((tag) => tag.id === "default-type")?.type).toBe("single_select");
  });

  test("seeds the Flags interrupt tag after Complexity", async () => {
    const storage = createMemoryStorage();

    await seedDefaultTags(storage);

    const humanRequested = (await tagsCollection(storage).list()).find((tag) => tag.id === "default-human-requested");
    expect(humanRequested).toMatchObject({ name: "Flags", type: "multi_select", sortOrder: 3 });
    expect(humanRequested?.options).toEqual(HUMAN_REQUESTED_TAG().options);
  });

  test("refreshes an existing default handoff flag while keeping its identity and metadata", async () => {
    const storage = createMemoryStorage();
    await seedDefaultTags(storage);
    const current = HUMAN_REQUESTED_TAG();
    const expectedOption = { ...current.options[0]!, description: "Review before continuing", sortOrder: 2 };
    const customOption = { ...expectedOption, id: "custom-flag", name: "Follow up", sortOrder: 1 };
    await tagsCollection(storage).put(current.id, {
      ...current,
      name: "Workflow",
      options: [customOption, { ...expectedOption, name: "Human Requested", color: "purple", icon: "eye" }],
    });

    const seeded = await seedDefaultTags(storage);
    const expected = { ...current, name: "Workflow", options: [customOption, expectedOption] };

    expect(seeded.find((tag) => tag.id === current.id)).toEqual(expected);
    expect(await tagsCollection(storage).get(current.id)).toEqual(expected);
    expect(await seedDefaultTags(storage)).toEqual(seeded);
  });

  test("preserves a customized handoff flag", async () => {
    const storage = createMemoryStorage();
    await seedDefaultTags(storage);
    const current = HUMAN_REQUESTED_TAG();
    const customized = {
      ...current,
      options: [{ ...current.options[0]!, name: "Needs a person", color: "blue", icon: "user" }],
    };
    await tagsCollection(storage).put(current.id, customized);

    await seedDefaultTags(storage);

    expect(await tagsCollection(storage).get(current.id)).toEqual(customized);
  });

  test("backfills human_requested into projects with customized tags", async () => {
    const storage = createMemoryStorage();
    await tagsCollection(storage).put("custom-tag", {
      id: "custom-tag",
      name: "Custom",
      type: "single_select",
      sortOrder: 0,
      options: [],
    });

    const seeded = await seedDefaultTags(storage);

    expect(seeded.map((tag) => tag.id)).toContain("default-human-requested");
    expect(seeded.map((tag) => tag.id)).toContain("custom-tag");
    expect(seeded.map((tag) => tag.id)).not.toContain("default-priority");
  });

  test("restores the required Review Needed workflow tag after deletion", async () => {
    const storage = createMemoryStorage();
    await seedDefaultTags(storage);

    await tagsCollection(storage).delete("default-human-requested");
    const seeded = await seedDefaultTags(storage);

    expect(seeded.map((tag) => tag.id)).toContain("default-human-requested");
  });

  test("completes a partial default seed before the seeded marker is written", async () => {
    const storage = createMemoryStorage();
    const first = DEFAULT_TAGS[0]();
    await tagsCollection(storage).put(first.id, first);

    const seeded = await seedDefaultTags(storage);

    expect(first.id).toBe("default-priority");
    expect(seeded.map((tag) => tag.id)).toEqual([
      "default-priority",
      "default-type",
      "default-complexity",
      "default-human-requested",
    ]);
  });

  test("draws the default complexity options with level glyphs", () => {
    const complexity = DEFAULT_TAGS.map((seed) => seed()).find((tag) => tag.id === "default-complexity");

    expect(complexity?.options.map((option) => option.icon)).toEqual(["level-low", "level-high", "level-xhigh"]);
  });
});
