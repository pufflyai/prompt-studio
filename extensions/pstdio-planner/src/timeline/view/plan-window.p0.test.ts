import { expect, test } from "bun:test";
import { adjacentPlanWindow, PLAN_WINDOW_SIZE } from "./plan-window";

test("Timeline windows remain bounded while reaching later tickets in both directions", () => {
  expect(PLAN_WINDOW_SIZE).toBe(200);
  expect(adjacentPlanWindow(0, "previous", true)).toBe(0);
  expect(adjacentPlanWindow(0, "next", true)).toBe(100);
  expect(adjacentPlanWindow(100, "next", false)).toBe(100);
  expect(adjacentPlanWindow(100, "previous", false)).toBe(0);
});
