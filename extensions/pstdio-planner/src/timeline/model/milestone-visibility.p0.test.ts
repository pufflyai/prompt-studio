import { expect, test } from "bun:test";
import type { PlanSection } from "../contracts";
import { milestoneVisible } from "./milestone-visibility";

const section = (daysLeft: number | null, done = 0, total = 2) =>
  ({
    deadline: daysLeft === null ? null : { id: "release", date: "2026-10-21", daysLeft },
    rows: [],
    counts: { total, done, humanNeeded: 0, blocked: 0, atRisk: 0 },
    eta: null,
  }) satisfies PlanSection;

test("milestones are visible by default", () => {
  expect(milestoneVisible(section(-1, 2), {})).toBe(true);
});
test("passed milestones exclude today and unscheduled tickets", () => {
  expect(milestoneVisible(section(-1), { showPassedMilestones: false })).toBe(false);
  expect(milestoneVisible(section(0), { showPassedMilestones: false })).toBe(true);
  expect(milestoneVisible(section(null), { showPassedMilestones: false })).toBe(true);
});
test("completed milestones require at least one ticket and all tickets done", () => {
  const display = { showCompletedMilestones: false };
  expect(milestoneVisible(section(1, 2), display)).toBe(false);
  expect(milestoneVisible(section(1, 1), display)).toBe(true);
  expect(milestoneVisible(section(1, 0, 0), display)).toBe(true);
  expect(milestoneVisible(section(null, 2), display)).toBe(true);
});
