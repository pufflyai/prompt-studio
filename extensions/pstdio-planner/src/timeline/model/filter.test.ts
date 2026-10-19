import { expect, test } from "bun:test";
import { DEFAULT_STATUSES, DEFAULT_TAGS } from "../../data/seed";
import { buildPlan } from "./build-plan";
import { filterSections } from "./filter";
import { reviewQueue } from "./review";

const plan = buildPlan({
  today: "2026-10-13",
  now: Date.parse("2026-10-13T12:00:00Z"),
  statuses: DEFAULT_STATUSES,
  tags: DEFAULT_TAGS.map((seed) => seed()),
  attempts: [{ ticketId: "done", createdAt: "2026-10-13T10:00:00Z" }],
  requests: new Map(["open", "hidden"].map((id) => [id, { requests: [], errors: ["Unreadable request"] }])),
  tickets: [
    {
      id: "done",
      shorthand: "P-1",
      title: "Finished",
      content: "",
      statusId: "done",
      tagIds: ["default-complexity-simple"],
    },
    {
      id: "open",
      shorthand: "P-2",
      title: "Visible",
      content: "",
      statusId: "ready",
      tagIds: ["default-complexity-complex"],
    },
    {
      id: "hidden",
      shorthand: "P-3",
      title: "Hidden",
      content: "",
      statusId: "ready",
      tagIds: ["default-complexity-simple"],
    },
  ],
  plan: {
    deadlines: [
      { id: "release", date: "2026-10-15" },
      { id: "empty", date: "2026-10-16" },
    ],
    order: ["done", "open", "hidden"].map((ticketId) => ({ ticketId, deadlineId: "release" })),
  },
});

test("filtered milestone summaries and review queues use only matching tickets", () => {
  const section = filterSections(plan, new Set(["done", "open"]))[0]!;
  expect(section.counts).toEqual({ total: 2, done: 1, humanNeeded: 1, blocked: 0, atRisk: 1 });
  expect(section.eta).toMatchObject({ totalComplexity: 4, completedComplexity: 1, remainingMs: 6 * 60 * 60 * 1000 });
  expect(reviewQueue(section.rows)).toEqual(["open"]);
  expect(plan.sections[0]!.counts.total).toBe(3);
});

test("hiding completed tickets preserves the observed pace for visible remaining work", () => {
  const section = filterSections(plan, new Set(["open"]))[0]!;
  expect(section.counts).toMatchObject({ total: 1, done: 0, humanNeeded: 1 });
  expect(section.eta).toMatchObject({ totalComplexity: 3, completedComplexity: 0, remainingMs: 6 * 60 * 60 * 1000 });
});

test("a completed-only view shows Done while empty milestones stay visible without an estimate", () => {
  const sections = filterSections(plan, new Set(["done"]));
  expect(sections[0]!.eta?.remainingMs).toBe(0);
  expect(sections[0]!.counts).toMatchObject({ total: 1, done: 1, humanNeeded: 0 });
  expect(sections[1]!.rows).toEqual([]);
  expect(sections[1]!.eta).toBeNull();
  expect(filterSections(plan, new Set()).map(({ deadline }) => deadline?.id)).toEqual(["empty", undefined]);
});
