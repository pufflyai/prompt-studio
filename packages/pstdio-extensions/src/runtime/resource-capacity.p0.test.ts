import { expect, test } from "bun:test";
import { reserveResourceCapacity } from "./resource-capacity";

test("keeps fractional CPU quotas within the observed quota while allowing serial progress", () => {
  const capacity = reserveResourceCapacity(0.1, 1024 ** 3, []);
  expect(capacity.cpu).toBeGreaterThan(0);
  expect(capacity.cpu).toBeLessThan(0.1);
  expect(capacity.memory).toBe(768);
});

test("allows zero memory admissions after the host reserve", () => {
  expect(reserveResourceCapacity(1, 128 * 1024 ** 2, []).memory).toBe(0);
});
