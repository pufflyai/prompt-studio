import { describe, expect, test } from "bun:test";
import { callsTo, makeAutomationContext, makeTicket } from "../automation-context.fixture";
import { refineTicketsCommand } from "./refine-tickets";

const run = (ctx: Parameters<typeof refineTicketsCommand.run>[0]) => refineTicketsCommand.run(ctx);

describe("refine-tickets automation", () => {
  test("does nothing while automation.enabled is off", async () => {
    const { ctx, calls } = makeAutomationContext({
      tickets: [makeTicket({ id: "t1" })],
      settings: { "automation.enabled": false },
    });

    const result = await run(ctx as never);

    expect(result).toEqual({ ran: false, reason: "automation.enabled is off" });
    expect(calls).toEqual([]);
  });

  test("refines the oldest-updated Backlog ticket without human_requested", async () => {
    const { ctx, calls } = makeAutomationContext({
      tickets: [
        makeTicket({ id: "t1", updatedAt: "2026-06-03T00:00:00.000Z" }),
        makeTicket({ id: "t2", updatedAt: "2026-06-01T00:00:00.000Z", tagIds: ["human-requested-true"] }),
        makeTicket({ id: "t3", updatedAt: "2026-06-02T00:00:00.000Z" }),
        makeTicket({ id: "t4", statusId: "ready", updatedAt: "2026-05-01T00:00:00.000Z" }),
      ],
    });

    const result = await run(ctx as never);

    expect(result).toMatchObject({ ran: true, refined: "T3" });
    expect(callsTo(calls, "pstdio-planner.refine-ticket")).toEqual([
      { commandId: "pstdio-planner.refine-ticket", params: { ticket: "T3" } },
    ]);
  });

  test("skips drafts and reports a no-op when nothing is eligible", async () => {
    const { ctx, calls, activities } = makeAutomationContext({
      tickets: [makeTicket({ id: "t1", draft: true }), makeTicket({ id: "t2", tagIds: ["human-requested-true"] })],
    });

    const result = await run(ctx as never);

    expect(result).toMatchObject({ ran: true, refined: null });
    expect(callsTo(calls, "pstdio-planner.refine-ticket")).toEqual([]);
    expect(activities.at(-1)?.message).toContain("no eligible Backlog ticket");
  });

  test("does not start another refinement while one is still running", async () => {
    const state = {
      tickets: [makeTicket({ id: "t1" }), makeTicket({ id: "t2" })],
      sessionsById: { "refine-session-1": { id: "refine-session-1", status: "in_progress" } },
    };
    const { ctx, calls } = makeAutomationContext(state);

    await run(ctx as never);
    const second = await run(ctx as never);

    expect(second).toMatchObject({ ran: true, refined: null, running: 1 });
    expect(callsTo(calls, "pstdio-planner.refine-ticket")).toHaveLength(1);
  });

  test("moves the ticket to TODO and adds human_requested when refinement completes", async () => {
    const state = {
      tickets: [makeTicket({ id: "t1" })],
      sessionsById: { "refine-session-1": { id: "refine-session-1", status: "completed" } },
    };
    const { ctx } = makeAutomationContext(state);

    await run(ctx as never); // starts the refinement
    await run(ctx as never); // reconciles the completed session

    expect(state.tickets[0]).toMatchObject({ statusId: "ready", tagIds: ["human-requested-true"] });
  });

  test("leaves a failed refinement in Backlog and re-picks it on a later tick", async () => {
    const state = {
      tickets: [makeTicket({ id: "t1" })],
      sessionsById: { "refine-session-1": { id: "refine-session-1", status: "failed" } },
    };
    const { ctx, calls } = makeAutomationContext(state);

    await run(ctx as never);
    const second = await run(ctx as never);

    expect(state.tickets[0]).toMatchObject({ statusId: "backlog", tagIds: [] });
    expect(second).toMatchObject({ ran: true, refined: "T1" });
    expect(callsTo(calls, "pstdio-planner.refine-ticket")).toHaveLength(2);
  });

  test("does not promote a ticket a human already moved out of Backlog", async () => {
    const state = {
      tickets: [makeTicket({ id: "t1" })],
      sessionsById: { "refine-session-1": { id: "refine-session-1", status: "completed" } },
    };
    const { ctx, calls } = makeAutomationContext(state);

    await run(ctx as never);
    state.tickets[0].statusId = "done";
    await run(ctx as never);

    expect(state.tickets[0]).toMatchObject({ statusId: "done", tagIds: [] });
    expect(callsTo(calls, "pstdio-planner.set-ticket-attribute")).toEqual([]);
  });
});
