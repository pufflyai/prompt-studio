import { expect, test } from "bun:test";
import { createStoragePositions } from "./storage-positions";

test("ten thousand inserts on two devices converge in strict order without changing existing positions", () => {
  const devices = [createStoragePositions("device-a"), createStoragePositions("device-b")];
  const received: string[][] = [[], []];
  let seed = 843;
  for (let i = 0; i < 5_000; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const index = seed % (received[0]!.length + 1);
    const before = received[0]![index - 1];
    const after = received[0]![index];
    const concurrent = devices.map((device) => device.between(before, after));
    for (const position of concurrent) {
      if (before !== undefined) expect(position > before).toBe(true);
      if (after !== undefined) expect(position < after).toBe(true);
    }
    received[0]!.splice(index, 0, ...[...concurrent].sort());
    received[1]!.push(...[...concurrent].reverse());
  }
  expect(received[1]!.sort()).toEqual(received[0]!);
  expect(new Set(received[0]).size).toBe(10_000);
  for (let i = 1; i < received[0]!.length; i++) expect(received[0]![i - 1]! < received[0]![i]!).toBe(true);
});

test("positions remain dense at either end and between concurrent neighbours", () => {
  const device = createStoragePositions("device");
  let left = device.between();
  let right = device.between();
  [left, right] = [left, right].sort() as [string, string];
  let first = left;
  let last = right;
  for (let i = 0; i < 1_000; i++) {
    const before = device.between(undefined, first);
    const after = device.between(last);
    const middle = device.between(left, right);
    expect(before < first && left < middle && middle < right && last < after).toBe(true);
    first = before;
    last = after;
    right = middle;
  }
  expect(() => device.between(left, left)).toThrow();
  expect(() => device.between(right, left)).toThrow();
  expect(() => device.between("invalid")).toThrow();
});
