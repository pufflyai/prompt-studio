import { expect, test } from "bun:test";
import { upgradeWorkerCount } from "./upgrade-concurrency";

const hosts: [number, number, ReturnType<typeof upgradeWorkerCount>][] = [
  [1, 2, 1],
  [2, 16, 1],
  [3, 5, 1],
  [3, 6, 2],
  [3, 7, 2],
  [4, 16, 2],
  [6, 12, 3],
  [16, 4, 1],
  [8, 16, 4],
  [64, 256, 4],
  [8, 8, 2],
];

for (const [cores, gb, count] of hosts) {
  test(`sizes updates for ${cores} cores and ${gb} GB`, () => {
    expect(upgradeWorkerCount(cores, gb * 1_000_000_000)).toBe(count);
  });
}
