import { describe, expect, test } from "bun:test";
import { statusesCollection } from "./collections";
import { createMemoryStorage } from "./memory-storage";
import { DEFAULT_STATUSES, seedDefaultStatuses } from "./seed";

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

  test("exposes exactly one default status", () => {
    expect(DEFAULT_STATUSES.filter((status) => status.isDefault)).toHaveLength(1);
  });
});
