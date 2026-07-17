import { describe, expect, test } from "bun:test";
import extension from "./extension";

describe("pstdio-planner-loops extension", () => {
  test("contributes the planner automation commands", () => {
    expect(Object.keys(extension.commands ?? {}).sort()).toEqual([
      "implement-tickets",
      "refine-tickets",
      "review-tickets",
      "stuck-work-sweep",
    ]);
  });

  test("schedules every automation against its own command", () => {
    expect(extension.schedules).toMatchObject({
      refineTickets: { cron: "0 * * * *", command: { id: "pstdio-planner-loops.refine-tickets" } },
      implementTickets: { cron: "*/5 * * * *", command: { id: "pstdio-planner-loops.implement-tickets" } },
      stuckWorkSweep: { cron: "0 * * * *", command: { id: "pstdio-planner-loops.stuck-work-sweep" } },
      reviewTickets: { cron: "2-59/5 * * * *", command: { id: "pstdio-planner-loops.review-tickets" } },
    });
  });

  test("ships autonomous planner work disabled by default", () => {
    expect(extension.settings?.properties).toMatchObject({
      "automation.enabled": { type: "boolean", scope: "project", default: false },
    });
  });
});
