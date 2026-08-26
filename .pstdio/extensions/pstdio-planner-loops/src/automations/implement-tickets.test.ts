import { describe, expect, test } from "bun:test";
import { callsTo, makeAttempt, makeAutomationContext, makeTicket } from "../automation-context.fixture";
import { implementTicketsCommand } from "./implement-tickets";

const run = (ctx: Parameters<typeof implementTicketsCommand.run>[0]) => implementTicketsCommand.run(ctx, {});

describe("implement-tickets automation", () => {
  test("asks Planner to start Todo tickets by priority until live attempt capacity is full", async () => {
    const { ctx, calls } = makeAutomationContext({
      tickets: [
        makeTicket({ id: "t1", shorthand: "T1", statusId: "ready", tagIds: ["priority-low"] }),
        makeTicket({ id: "t2", shorthand: "T2", statusId: "ready", tagIds: ["priority-urgent"] }),
        makeTicket({ id: "t3", shorthand: "T3", statusId: "ready", tagIds: ["priority-high"] }),
      ],
      maxInProgress: 2,
    });

    const result = await run(ctx as never);

    expect(result).toMatchObject({
      implemented: ["T2", "T3"],
      waits: [{ ticket: "T1", reason: "capacity-full" }],
    });
    expect(callsTo(calls, "pstdio.pstdio-planner.command.run-attempt").map((call) => call.params.ticket)).toEqual([
      "T2",
      "T3",
      "T1",
    ]);
  });

  test("skips tickets carrying the stable Human Requested flag", async () => {
    const { ctx } = makeAutomationContext({
      tickets: [
        makeTicket({
          id: "t1",
          shorthand: "T1",
          statusId: "ready",
          tagIds: ["default-human-requested-true"],
        }),
        makeTicket({ id: "t2", shorthand: "T2", statusId: "ready" }),
      ],
    });

    const result = await run(ctx as never);

    expect(result).toMatchObject({ implemented: ["T2"] });
  });

  test("uses live attempts rather than In Progress ticket count for capacity", async () => {
    const { ctx } = makeAutomationContext({
      tickets: [
        makeTicket({ id: "t1", shorthand: "T1", statusId: "in-progress" }),
        makeTicket({ id: "t2", shorthand: "T2", statusId: "ready" }),
      ],
      attempts: [makeAttempt({ workspaceId: "workspace-1", ticketId: "t1", state: "approved" })],
      maxInProgress: 1,
    });

    const result = await run(ctx as never);

    expect(result).toMatchObject({ implemented: ["T2"], waits: [] });
  });

  test("no-ops when nothing is eligible", async () => {
    const { ctx, activities } = makeAutomationContext({
      tickets: [makeTicket({ id: "t1", statusId: "backlog" })],
    });

    const result = await run(ctx as never);

    expect(result).toMatchObject({ implemented: [] });
    expect(activities.at(-1)?.message).toContain("no eligible TODO ticket");
  });
});
