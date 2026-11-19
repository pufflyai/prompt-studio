import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { claimEnvironment, releaseEnvironment } from "./environments";

test("only one concurrent run can claim the same environment", async () => {
  const store = createMemoryStorage();
  const claims = await Promise.all([
    claimEnvironment(store, "environment", "first", 60),
    claimEnvironment(store, "environment", "second", 60),
  ]);
  expect(claims.filter(Boolean)).toHaveLength(1);
});

test("a late release cannot remove a replacement claim", async () => {
  const store = createMemoryStorage();
  expect(await claimEnvironment(store, "environment", "old", -1)).toBe(true);
  expect(await claimEnvironment(store, "environment", "new", 60)).toBe(true);
  await releaseEnvironment(store, "environment", "old");
  expect(await claimEnvironment(store, "environment", "other", 60)).toBe(false);
});
