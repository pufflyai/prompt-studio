import { expect, test } from "bun:test";
import { createStorageMigration } from "./storage-identities";
import { createStoragePositions } from "./storage-positions";

test("migration positions preserve a stable initial order on independent devices", () => {
  const first = createStorageMigration(["planner", "project", 4]);
  const second = createStorageMigration(["planner", "project", 4]);
  const ranks = [0, 1, 15, 16, 255, 256, 100_000, Number.MAX_SAFE_INTEGER];
  const positions = ranks.map((rank) => first.position(rank, `item-${rank}`));
  expect(positions).toEqual(ranks.map((rank) => second.position(rank, `item-${rank}`)));
  expect([...positions].sort()).toEqual(positions);
  expect(new Set(positions).size).toBe(ranks.length);

  const devices = [createStoragePositions("device-a"), createStoragePositions("device-b")];
  const before = positions[2]!;
  const after = positions[3]!;
  const concurrent = devices.map((device) => device.between(before, after));
  expect(concurrent[0]).not.toBe(concurrent[1]);
  for (const position of concurrent) expect(before < position && position < after).toBe(true);
  expect(devices[0]!.between(undefined, positions[0]) < positions[0]!).toBe(true);
  expect(devices[1]!.between(positions.at(-1)) > positions.at(-1)!).toBe(true);
});

test("migration positions require a nonnegative safe integer rank", () => {
  const migration = createStorageMigration(["planner", "project", 4]);
  for (const rank of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    expect(() => migration.position(rank, "item")).toThrow(RangeError);
  }
});

test("different offline source lists keep same-rank records distinct and divisible", () => {
  const migration = createStorageMigration(["planner", "project", 4]);
  const left = migration.position(0, "ticket-a");
  const right = migration.position(0, "ticket-b");
  expect(left).not.toBe(right);
  const ordered = [left, right].sort();
  const between = createStoragePositions("device").between(ordered[0], ordered[1]);
  expect(ordered[0]! < between && between < ordered[1]!).toBe(true);
  expect(migration.position(0, "ticket-a")).toBe(left);
});

test("migration item keys keep case, nulls and lone surrogates distinct", () => {
  const migration = createStorageMigration(["owner", 1]);
  const keys = ["", "a", "A", "a\0", "a1", "\ud800", "\ud801", "\ufffd"];
  const positions = keys.map((key) => migration.position(0, key)).sort();
  expect(new Set(positions).size).toBe(keys.length);
  const device = createStoragePositions("device");
  for (let index = 1; index < positions.length; index++) {
    const before = positions[index - 1]!;
    const after = positions[index]!;
    const middle = device.between(before, after);
    expect(before < middle && middle < after).toBe(true);
  }
});
