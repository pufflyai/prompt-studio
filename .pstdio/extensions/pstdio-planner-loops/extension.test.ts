import { describe, expect, test } from "bun:test";
import extension from "./extension";

describe("pstdio-planner-loops extension", () => {
  test("contributes the planner automation commands", () => {
    expect(extension.commands?.map((command) => command.id).sort()).toEqual([
      "implement-tickets",
      "refine-tickets",
      "review-tickets",
      "stuck-work-sweep",
    ]);
  });

  test("schedules every automation against its own command", () => {
    expect(extension.schedules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "refineTickets",
          schedule: "0 * * * *",
          command: { id: "refine-tickets", kind: "command" },
        }),
        expect.objectContaining({
          id: "implementTickets",
          schedule: "*/5 * * * *",
          command: { id: "implement-tickets", kind: "command" },
        }),
        expect.objectContaining({
          id: "stuckWorkSweep",
          schedule: "0 * * * *",
          command: { id: "stuck-work-sweep", kind: "command" },
        }),
        expect.objectContaining({
          id: "reviewTickets",
          schedule: "2-59/5 * * * *",
          command: { id: "review-tickets", kind: "command" },
        }),
      ]),
    );
  });
});
