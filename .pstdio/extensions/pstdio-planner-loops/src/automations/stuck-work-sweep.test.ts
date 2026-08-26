import { describe, expect, test } from "bun:test";
import { callsTo, makeAttempt, makeAutomationContext, makeTicket } from "../automation-context.fixture";
import { stuckWorkSweepCommand } from "./stuck-work-sweep";

describe("stuck-work-sweep automation", () => {
  test("reconciles managed implementation and review attempts by workspace", async () => {
    const { ctx, calls } = makeAutomationContext({
      tickets: [makeTicket({ id: "t1", shorthand: "T1" }), makeTicket({ id: "t2", shorthand: "T2" })],
      attempts: [
        makeAttempt({ workspaceId: "workspace-1", ticketId: "t1", state: "implementing" }),
        makeAttempt({ workspaceId: "workspace-2", ticketId: "t2", state: "reviewing" }),
        makeAttempt({ workspaceId: "workspace-3", ticketId: "t2", state: "approved" }),
      ],
      reconcileDecisions: {
        "workspace-1": "implementation-retried",
        "workspace-2": "review-retried",
      },
    });

    const result = await stuckWorkSweepCommand.run(ctx as never, {});

    expect(result.decisions).toEqual([
      { ticket: "T1", workspaceId: "workspace-1", decision: "implementation-retried" },
      { ticket: "T2", workspaceId: "workspace-2", decision: "review-retried" },
    ]);
    expect(
      callsTo(calls, "pstdio.pstdio-planner.command.reconcile-attempt").map((call) => call.params.workspaceId),
    ).toEqual(["workspace-1", "workspace-2"]);
  });

  test("does not infer work from ticket status when no managed attempt exists", async () => {
    const { ctx, calls, activities } = makeAutomationContext({
      tickets: [makeTicket({ id: "t1", shorthand: "T1", statusId: "in-progress" })],
    });

    const result = await stuckWorkSweepCommand.run(ctx as never, {});

    expect(result.decisions).toEqual([]);
    expect(callsTo(calls, "pstdio.pstdio-planner.command.reconcile-attempt")).toEqual([]);
    expect(activities.at(-1)?.message).toContain("no managed attempts");
  });
});
