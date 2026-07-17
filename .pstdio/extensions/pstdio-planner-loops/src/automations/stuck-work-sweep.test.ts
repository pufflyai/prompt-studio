import { describe, expect, test } from "bun:test";
import { makeAutomationContext, makeTicket } from "../automation-context.fixture";
import { stuckWorkSweepCommand } from "./stuck-work-sweep";

const HOURS_AGO_2 = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
const MINUTES_AGO_10 = new Date(Date.now() - 10 * 60 * 1000).toISOString();

const workspace = (id: string) => ({ id, workspace: `${id}-shorthand`, branch: "b", path: "/wt", active: false });

const run = (ctx: Parameters<typeof stuckWorkSweepCommand.run>[0]) => stuckWorkSweepCommand.run(ctx);

describe("stuck-work-sweep automation", () => {
  test("does nothing while automation.enabled is off", async () => {
    const { ctx, calls } = makeAutomationContext({ tickets: [], settings: { "automation.enabled": false } });

    const result = await run(ctx as never);

    expect(result).toEqual({ ran: false, reason: "automation.enabled is off" });
    expect(calls).toEqual([]);
  });

  test("moves a stuck ticket to In Review after a completed session", async () => {
    const state = {
      tickets: [makeTicket({ id: "t1", statusId: "in-progress", updatedAt: HOURS_AGO_2 })],
      workspacesByTicket: { T1: [workspace("w1")] },
      activityByWorkspace: {
        w1: {
          active: false,
          sessions: [
            { id: "s1", title: "old", status: "failed", createdAt: "2026-06-01T00:00:00.000Z" },
            { id: "s2", title: "new", status: "completed", createdAt: "2026-06-02T00:00:00.000Z" },
          ],
        },
      },
    };
    const { ctx } = makeAutomationContext(state);

    const result = await run(ctx as never);

    expect(result).toMatchObject({ decisions: [{ ticket: "T1", decision: "in-review" }] });
    expect(state.tickets[0].statusId).toBe("in-review");
  });

  test.each([
    "failed",
    "disconnected",
    "cancelled",
  ])("moves a stuck ticket to Blocked after a %s session", async (status) => {
    const state = {
      tickets: [makeTicket({ id: "t1", statusId: "in-progress", updatedAt: HOURS_AGO_2 })],
      workspacesByTicket: { T1: [workspace("w1")] },
      activityByWorkspace: {
        w1: { active: false, sessions: [{ id: "s1", title: "s", status, createdAt: "2026-06-02T00:00:00.000Z" }] },
      },
    };
    const { ctx } = makeAutomationContext(state);

    const result = await run(ctx as never);

    expect(result).toMatchObject({ decisions: [{ ticket: "T1", decision: "blocked" }] });
    expect(state.tickets[0].statusId).toBe("blocked");
  });

  test("leaves a ticket alone while any linked workspace is active", async () => {
    const state = {
      tickets: [makeTicket({ id: "t1", statusId: "in-progress", updatedAt: HOURS_AGO_2 })],
      workspacesByTicket: { T1: [workspace("w1"), workspace("w2")] },
      activityByWorkspace: {
        w1: { active: false, sessions: [{ id: "s1", title: "s", status: "completed" }] },
        w2: { active: true, sessions: [{ id: "s2", title: "s", status: "in_progress" }] },
      },
    };
    const { ctx } = makeAutomationContext(state);

    const result = await run(ctx as never);

    expect(result).toMatchObject({ decisions: [{ ticket: "T1", decision: "active" }] });
    expect(state.tickets[0].statusId).toBe("in-progress");
  });

  test("records and leaves tickets without sessions unchanged", async () => {
    const state = {
      tickets: [makeTicket({ id: "t1", statusId: "in-progress", updatedAt: HOURS_AGO_2 })],
      workspacesByTicket: { T1: [workspace("w1")] },
    };
    const { ctx, activities } = makeAutomationContext(state);

    const result = await run(ctx as never);

    expect(result).toMatchObject({ decisions: [{ ticket: "T1", decision: "no-sessions" }] });
    expect(state.tickets[0].statusId).toBe("in-progress");
    expect(activities.some((activity) => activity.message.includes("no sessions recorded"))).toBe(true);
  });

  test("ignores tickets updated within the last hour", async () => {
    const { ctx, calls } = makeAutomationContext({
      tickets: [makeTicket({ id: "t1", statusId: "in-progress", updatedAt: MINUTES_AGO_10 })],
    });

    const result = await run(ctx as never);

    expect(result).toMatchObject({ decisions: [] });
    expect(calls.some((call) => call.commandId === "pstdio-planner.ticket-workspaces")).toBe(false);
  });
});
