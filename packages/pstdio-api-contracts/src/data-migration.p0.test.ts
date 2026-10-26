import { expect, test } from "bun:test";
import { createDataMigrationRunner } from "./data-migration";

test("concurrent migrations share a version and save it only after successful work", async () => {
  let version = 0;
  const migrate = createDataMigrationRunner({
    readVersion: async () => version,
    writeVersion: async (next) => {
      version = next;
    },
  });
  const release = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>();
  const seen: number[] = [];
  const first = migrate(1, async (previous) => {
    seen.push(previous);
    entered.resolve();
    await release.promise;
  });
  await entered.promise;
  const second = migrate(2, async (previous) => {
    seen.push(previous);
  });
  expect(version).toBe(0);
  release.resolve();
  await Promise.all([first, second]);
  expect(seen).toEqual([0, 1]);
  expect(version).toBe(2);
  await migrate(2, async () => {
    throw new Error("Already migrated");
  });
});

test("a failed migration retries from its last successful version", async () => {
  let version = 0;
  const migrate = createDataMigrationRunner({
    readVersion: async () => version,
    writeVersion: async (next) => {
      version = next;
    },
  });
  await expect(
    migrate(1, async () => {
      throw new Error("Import interrupted");
    }),
  ).rejects.toThrow("Import interrupted");
  expect(version).toBe(0);
  await migrate(1, async (previous) => {
    expect(previous).toBe(0);
  });
  await expect(migrate(0, async () => {})).rejects.toThrow("positive");
  await migrate(2, async () => {});
  await expect(migrate(1, async () => {})).rejects.toThrow("newer");
});
