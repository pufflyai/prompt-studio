import { expect, test } from "bun:test";
import { upgradeWorkerCount } from "./upgrade-concurrency";

test.each([
  [1, 2, 1],
  [2, 16, 1],
  [4, 16, 2],
  [6, 12, 3],
  [16, 4, 1],
  [8, 16, 4],
  [64, 256, 4],
])("sizes updates for %i cores and %i GiB", (cores, gib, count) => {
  expect(upgradeWorkerCount(cores, gib * 1024 ** 3)).toBe(count);
});
