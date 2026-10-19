import { expect, test } from "bun:test";
import { DEFAULT_STATUSES, DEFAULT_TAGS } from "../../data/seed";
import { buildPlan } from "./build-plan";

test("every milestone can use completed work elsewhere in the project to estimate its remaining work", () => {
  const plan = buildPlan({
    today: "2026-10-13",
    now: Date.parse("2026-10-13T12:00:00Z"),
    statuses: DEFAULT_STATUSES,
    tags: DEFAULT_TAGS.map((seed) => seed()),
    attempts: [{ ticketId: "done", createdAt: "2026-10-13T10:00:00Z" }],
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
        title: "Next release",
        content: "",
        statusId: "ready",
        tagIds: ["default-complexity-complex"],
      },
    ],
    plan: {
      deadlines: [
        { id: "first", date: "2026-10-14" },
        { id: "next", date: "2026-10-15" },
      ],
      order: [
        { ticketId: "done", deadlineId: "first" },
        { ticketId: "open", deadlineId: "next" },
      ],
    },
  });

  expect(plan.sections[0]!.eta?.remainingMs).toBe(0);
  expect(plan.sections[1]!.eta).toMatchObject({
    completedComplexity: 0,
    totalComplexity: 3,
    remainingMs: 6 * 60 * 60 * 1000,
  });
});
