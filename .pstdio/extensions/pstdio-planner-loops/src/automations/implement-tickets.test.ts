import { describe, expect, test } from "bun:test";
import { callsTo, makeAutomationContext, makeTicket } from "../automation-context.fixture";
import { implementTicketsCommand } from "./implement-tickets";

const run = (ctx: Parameters<typeof implementTicketsCommand.run>[0]) => implementTicketsCommand.run(ctx);

describe("implement-tickets automation", () => {
  test("implements TODO tickets by priority, then oldest created", async () => {
    const { ctx } = makeAutomationContext({
      tickets: [
        makeTicket({ id: "t1", statusId: "ready", createdAt: "2026-06-01T00:00:00.000Z" }),
        makeTicket({
          id: "t2",
          statusId: "ready",
          createdAt: "2026-06-03T00:00:00.000Z",
          tagIds: ["priority-urgent"],
        }),
        makeTicket({ id: "t3", statusId: "ready", createdAt: "2026-06-02T00:00:00.000Z", tagIds: ["priority-low"] }),
      ],
      maxInProgress: 2,
    });

    const result = await run(ctx as never);

    expect(result).toMatchObject({ implemented: ["T2", "T3"] });
  });

  test("skips tickets carrying human_requested", async () => {
    const { ctx } = makeAutomationContext({
      tickets: [
        makeTicket({ id: "t1", statusId: "ready", tagIds: ["human-requested-true"] }),
        makeTicket({ id: "t2", statusId: "ready" }),
      ],
    });

    const result = await run(ctx as never);

    expect(result).toMatchObject({ implemented: ["T2"] });
  });

  test("stops selecting at the planner automation policy", async () => {
    const { ctx, calls } = makeAutomationContext({
      tickets: [
        makeTicket({ id: "t1", statusId: "in-progress" }),
        makeTicket({ id: "t2", statusId: "ready" }),
        makeTicket({ id: "t3", statusId: "ready" }),
      ],
      maxInProgress: 2,
    });

    const result = await run(ctx as never);

    expect(result).toMatchObject({ implemented: ["T2"], inProgressCount: 1 });
    expect(callsTo(calls, "pstdio-planner.run-attempt")).toHaveLength(1);
  });

  test("no-ops when already at capacity", async () => {
    const { ctx, calls, activities } = makeAutomationContext({
      tickets: [
        makeTicket({ id: "t1", statusId: "in-progress" }),
        makeTicket({ id: "t2", statusId: "in-progress" }),
        makeTicket({ id: "t3", statusId: "ready" }),
      ],
      maxInProgress: 2,
    });

    const result = await run(ctx as never);

    expect(result).toMatchObject({ implemented: [], inProgressCount: 2 });
    expect(callsTo(calls, "pstdio-planner.run-attempt")).toEqual([]);
    expect(activities.at(-1)?.message).toContain("at capacity");
  });

  test("no-ops when nothing is eligible", async () => {
    const { ctx, activities } = makeAutomationContext({ tickets: [makeTicket({ id: "t1" })] });

    const result = await run(ctx as never);

    expect(result).toMatchObject({ implemented: [] });
    expect(activities.at(-1)?.message).toContain("no eligible TODO ticket");
  });
});
