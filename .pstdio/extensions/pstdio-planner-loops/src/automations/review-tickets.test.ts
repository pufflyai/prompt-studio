import { describe, expect, test } from "bun:test";
import { callsTo, makeAutomationContext, makeTicket } from "../automation-context.fixture";
import { reviewTicketsCommand } from "./review-tickets";

const workspace = (id: string) => ({ id, workspace: `${id}-shorthand`, branch: "b", path: "/wt", active: false });

const run = (ctx: Parameters<typeof reviewTicketsCommand.run>[0]) => reviewTicketsCommand.run(ctx);

describe("review-tickets automation", () => {
  test("does nothing while automation.enabled is off", async () => {
    const { ctx, calls } = makeAutomationContext({ tickets: [], settings: { "automation.enabled": false } });

    const result = await run(ctx as never);

    expect(result).toEqual({ ran: false, reason: "automation.enabled is off" });
    expect(calls).toEqual([]);
  });

  test("reviews the oldest-updated inactive In Review ticket", async () => {
    const { ctx, calls } = makeAutomationContext({
      tickets: [
        makeTicket({ id: "t1", statusId: "in-review", updatedAt: "2026-06-02T00:00:00.000Z" }),
        makeTicket({ id: "t2", statusId: "in-review", updatedAt: "2026-06-01T00:00:00.000Z" }),
      ],
      workspacesByTicket: { T1: [workspace("w1")], T2: [workspace("w2")] },
    });

    const result = await run(ctx as never);

    expect(result).toMatchObject({ ran: true, reviewed: "T2" });
    expect(callsTo(calls, "pstdio-planner.runReview")).toEqual([
      { commandId: "pstdio-planner.runReview", params: { workspaceId: "w2", ticket: "T2" } },
    ]);
  });

  test("skips tickets with an active workspace or human_requested", async () => {
    const { ctx, calls } = makeAutomationContext({
      tickets: [
        makeTicket({ id: "t1", statusId: "in-review", updatedAt: "2026-06-01T00:00:00.000Z" }),
        makeTicket({
          id: "t2",
          statusId: "in-review",
          updatedAt: "2026-06-02T00:00:00.000Z",
          tagIds: ["human-requested-true"],
        }),
      ],
      workspacesByTicket: { T1: [workspace("w1")] },
      activityByWorkspace: { w1: { active: true, sessions: [{ id: "s1", title: "s", status: "in_progress" }] } },
    });

    const result = await run(ctx as never);

    expect(result).toMatchObject({ ran: true, reviewed: null });
    expect(callsTo(calls, "pstdio-planner.runReview")).toEqual([]);
  });

  test("does not re-review a ticket while its review session runs", async () => {
    const { ctx, calls } = makeAutomationContext({
      tickets: [makeTicket({ id: "t1", statusId: "in-review" })],
      workspacesByTicket: { T1: [workspace("w1")] },
      sessionsById: { "review-session-1": { id: "review-session-1", status: "in_progress" } },
    });

    await run(ctx as never);
    const second = await run(ctx as never);

    expect(second).toMatchObject({ reviewed: null });
    expect(callsTo(calls, "pstdio-planner.runReview")).toHaveLength(1);
  });

  test("adds human_requested when a completed review leaves the ticket In Review", async () => {
    const state = {
      tickets: [makeTicket({ id: "t1", statusId: "in-review" })],
      workspacesByTicket: { T1: [workspace("w1")] },
      sessionsById: { "review-session-1": { id: "review-session-1", status: "completed" } },
    };
    const { ctx } = makeAutomationContext(state);

    await run(ctx as never);
    await run(ctx as never);

    expect(state.tickets[0].tagIds).toEqual(["human-requested-true"]);
    expect(state.tickets[0].statusId).toBe("in-review");
  });

  test("does not tag a ticket the reviewer moved out of In Review", async () => {
    const state = {
      tickets: [makeTicket({ id: "t1", statusId: "in-review" })],
      workspacesByTicket: { T1: [workspace("w1")] },
      sessionsById: { "review-session-1": { id: "review-session-1", status: "completed" } },
    };
    const { ctx } = makeAutomationContext(state);

    await run(ctx as never);
    state.tickets[0].statusId = "in-progress";
    await run(ctx as never);

    expect(state.tickets[0].tagIds).toEqual([]);
  });

  test("moves the ticket back to In Progress when the review session dies", async () => {
    const state = {
      tickets: [makeTicket({ id: "t1", statusId: "in-review" })],
      workspacesByTicket: { T1: [workspace("w1")] },
      sessionsById: { "review-session-1": { id: "review-session-1", status: "failed" } },
    };
    const { ctx } = makeAutomationContext(state);

    await run(ctx as never);
    await run(ctx as never);

    expect(state.tickets[0].statusId).toBe("in-progress");
    expect(state.tickets[0].tagIds).toEqual([]);
  });
});
