import { describe, expect, test } from "bun:test";
import { putStatus, putTag, statusesCollection, tagsCollection } from "./collections";
import { createMemoryStorage } from "./memory-storage";
import { DEFAULT_STATUSES, DEFAULT_TAGS, seedDefaultStatuses, seedDefaultTags } from "./seed";
import type { StoredStatus, StoredTag } from "./types";

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

  test("orders default board statuses with Refine between Backlog and Ready", () => {
    expect(
      DEFAULT_STATUSES.map((status) => ({
        id: status.id,
        name: status.name,
        sortOrder: status.sortOrder,
        isDefault: status.isDefault,
      })),
    ).toEqual([
      { id: "default-backlog", name: "Backlog", sortOrder: 0, isDefault: true },
      { id: "default-refine", name: "Refine", sortOrder: 1, isDefault: false },
      { id: "default-ready", name: "Ready", sortOrder: 2, isDefault: false },
      { id: "default-in-progress", name: "In Progress", sortOrder: 3, isDefault: false },
      { id: "default-blocked", name: "Blocked", sortOrder: 4, isDefault: false },
      { id: "default-in-review", name: "In Review", sortOrder: 5, isDefault: false },
      { id: "default-done", name: "Done", sortOrder: 6, isDefault: false },
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
    expect(stored.map((tag) => tag.name)).toEqual(["Priority", "Type", "Complexity", "human_requested"]);
    expect(stored.find((tag) => tag.id === "default-type")?.type).toBe("single_select");
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

  test("uses circle icons for the default complexity options", () => {
    const complexity = DEFAULT_TAGS.map((seed) => seed()).find((tag) => tag.id === "default-complexity");

    expect(complexity?.options.map((option) => option.icon ?? null)).toEqual([null, null, null]);
  });

  test("declares human_requested as a single-select tag with a single shield-user option", () => {
    const humanRequested = DEFAULT_TAGS.map((seed) => seed()).find((tag) => tag.id === "default-human-requested");

    expect(humanRequested).toMatchObject({
      name: "human_requested",
      type: "single_select",
      sortOrder: 3,
    });
    expect(humanRequested?.options).toEqual([
      {
        id: "default-human-requested-true",
        name: "True",
        color: "amber",
        sortOrder: 0,
        icon: "shield-user",
        description: null,
      },
    ]);
  });
});

describe("post-seed backfills", () => {
  // Simulates a project that was seeded before `Refine` existed: original defaults
  // are present, the seed marker is set, but the new default is missing.
  const seedLegacyStatuses = async (storage: ReturnType<typeof createMemoryStorage>) => {
    const legacy: StoredStatus[] = DEFAULT_STATUSES.filter((status) => status.id !== "default-refine");
    for (const status of legacy) await putStatus(storage, status);
    await storage.set("__pstdio-planner:default-statuses-seeded", true);
  };

  test("backfills Refine into a project that was seeded before it existed", async () => {
    const storage = createMemoryStorage();
    await seedLegacyStatuses(storage);

    const result = await seedDefaultStatuses(storage);

    expect(result.map((status) => status.id)).toContain("default-refine");
    expect(result.find((status) => status.id === "default-refine")).toMatchObject({
      name: "Refine",
      sortOrder: 1,
      color: "purple",
    });
  });

  test("does not resurrect Refine after a user removes it", async () => {
    const storage = createMemoryStorage();
    await seedLegacyStatuses(storage);
    // First call backfills Refine and sets the per-id marker.
    await seedDefaultStatuses(storage);
    await statusesCollection(storage).delete("default-refine");

    const result = await seedDefaultStatuses(storage);

    expect(result.map((status) => status.id)).not.toContain("default-refine");
  });

  test("backfills human_requested into a project that was seeded before it existed", async () => {
    const storage = createMemoryStorage();
    const legacyTags = DEFAULT_TAGS.filter((seed) => seed().id !== "default-human-requested");
    for (const tag of legacyTags) await putTag(storage, tag());
    await storage.set("__pstdio-planner:default-tags-seeded", true);

    const result = await seedDefaultTags(storage);

    const humanRequested = result.find((tag: StoredTag) => tag.id === "default-human-requested");
    expect(humanRequested).toBeDefined();
    expect(humanRequested?.options.map((option) => option.icon)).toEqual(["shield-user"]);
  });

  test("does not resurrect human_requested after a user removes it", async () => {
    const storage = createMemoryStorage();
    const legacyTags = DEFAULT_TAGS.filter((seed) => seed().id !== "default-human-requested");
    for (const tag of legacyTags) await putTag(storage, tag());
    await storage.set("__pstdio-planner:default-tags-seeded", true);
    await seedDefaultTags(storage);
    await tagsCollection(storage).delete("default-human-requested");

    const result = await seedDefaultTags(storage);

    expect(result.map((tag: StoredTag) => tag.id)).not.toContain("default-human-requested");
  });

  test("backfill leaves user customisations untouched", async () => {
    const storage = createMemoryStorage();
    await seedLegacyStatuses(storage);
    // User renamed Backlog after the legacy seed.
    await putStatus(storage, { ...DEFAULT_STATUSES[0], name: "Inbox" });

    await seedDefaultStatuses(storage);

    const stored = await statusesCollection(storage).list();
    expect(stored.find((status) => status.id === "default-backlog")?.name).toBe("Inbox");
    expect(stored.find((status) => status.id === "default-refine")).toBeDefined();
  });
});
