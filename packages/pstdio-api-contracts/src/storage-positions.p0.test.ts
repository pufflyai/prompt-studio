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

test("a long sequence of appends or prepends stays distinguishable in a bounded sort key", () => {
  const device = createStoragePositions("9daeb78d-4914-406b-8408-1f2abb678073");
  const prefixes = [new Set<string>(), new Set<string>()];
  let first = device.between();
  let last = first;
  for (let i = 0; i < 5000; i++) {
    first = device.between(undefined, first);
    last = device.between(last);
    prefixes[0]!.add(first.slice(0, 512));
    prefixes[1]!.add(last.slice(0, 512));
  }
  expect(prefixes.map((keys) => keys.size)).toEqual([5000, 5000]);
});

test("open bounds accept old positions at the ends of the alphabet", () => {
  const positions = createStoragePositions("device");
  for (const bound of ["1", "f", "f".repeat(1200), `${"0".repeat(1200)}1`, "efffffff", "100000001"]) {
    const earlier = positions.between(undefined, bound);
    const later = positions.between(bound);
    expect(earlier < bound && bound < later).toBe(true);
    expect(positions.between(earlier, bound) < bound).toBe(true);
    expect(positions.between(bound, later) > bound).toBe(true);
  }
});
