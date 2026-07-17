import { describe, expect, test } from "bun:test";
import { seedLayoutOnce } from "./layout-seed";

describe("seedLayoutOnce", () => {
  test("runs and persists a missing seed in order", () => {
    const log: string[] = [];
    const seeded = seedLayoutOnce({ hasPersistedLayout: () => false, persist: () => log.push("persist") }, () =>
      log.push("seed"),
    );

    expect(seeded).toBe(true);
    expect(log).toEqual(["seed", "persist"]);
  });

  test("skips an existing persisted scope", () => {
    const log: string[] = [];
    const seeded = seedLayoutOnce({ hasPersistedLayout: () => true, persist: () => log.push("persist") }, () =>
      log.push("seed"),
    );

    expect(seeded).toBe(false);
    expect(log).toEqual([]);
  });
});
