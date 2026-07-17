import { describe, expect, test } from "bun:test";
import { callsTo, makeAutomationContext, makeTicket } from "../automation-context.fixture";
import { sessionStartedHook, ticketRefFromLifecyclePayload } from "./session-started";

describe("ticketRefFromLifecyclePayload", () => {
  test("prefers the workspace ticket anchor", () => {
    expect(
      ticketRefFromLifecyclePayload({
        workspace: { anchors_json: [{ type: "ticket", id: "ticket-1" }] },
        branch: "workspace/T-9_A1",
      }),
    ).toBe("ticket-1");
  });

  test("falls back to the workspace shorthand convention", () => {
    expect(ticketRefFromLifecyclePayload({ workspace: { workspace_shorthand: "PS-7_A2" } })).toBe("PS-7");
  });

  test("falls back to the branch convention", () => {
    expect(ticketRefFromLifecyclePayload({ branch: "workspace/PS-7_A2" })).toBe("PS-7");
  });

  test("returns null without any ticket linkage", () => {
    expect(ticketRefFromLifecyclePayload({})).toBeNull();
  });
});

describe("sessionStarted hook", () => {
  test("moves the linked ticket into In Progress", async () => {
    const state = { tickets: [makeTicket({ id: "t1", shorthand: "PS-7" })] };
    const { ctx } = makeAutomationContext(state);

    await sessionStartedHook.handler(ctx as never, { workspace: { workspace_shorthand: "PS-7_A1" } });

    expect(state.tickets[0].statusId).toBe("in-progress");
  });

  test("leaves a ticket already in progress untouched", async () => {
    const state = { tickets: [makeTicket({ id: "t1", shorthand: "PS-7", statusId: "in-progress" })] };
    const { ctx, calls } = makeAutomationContext(state);

    await sessionStartedHook.handler(ctx as never, { workspace: { workspace_shorthand: "PS-7_A1" } });

    expect(callsTo(calls, "pstdio-planner.set-ticket-attribute")).toEqual([]);
  });

  test("ignores sessions without a ticket reference", async () => {
    const { ctx, calls } = makeAutomationContext({ tickets: [makeTicket({ id: "t1" })] });

    await sessionStartedHook.handler(ctx as never, { branch: "feature/unrelated" });

    expect(calls).toEqual([]);
  });

  test("does not move tickets for review sessions", async () => {
    const state = { tickets: [makeTicket({ id: "t1", shorthand: "PS-7", statusId: "in-review" })] };
    const { ctx, calls } = makeAutomationContext(state);

    await sessionStartedHook.handler(ctx as never, {
      anchors: [{ type: "planner-review", id: "t1" }],
      workspace: { workspace_shorthand: "PS-7_A1" },
    });

    expect(state.tickets[0].statusId).toBe("in-review");
    expect(callsTo(calls, "pstdio-planner.set-ticket-attribute")).toEqual([]);
  });
});
