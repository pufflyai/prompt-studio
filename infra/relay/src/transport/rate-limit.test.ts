import { expect, test } from "bun:test";
import { createRateLimit } from "./rate-limit";

test("a device may burst, then waits for its bucket to refill", () => {
  let time = 0;
  const allow = createRateLimit(2, 3, () => time);
  expect([allow("a"), allow("a"), allow("a"), allow("a")]).toEqual([true, true, true, false]);
  expect(allow("b")).toBe(true);
  time = 500;
  expect([allow("a"), allow("a")]).toEqual([true, false]);
});
