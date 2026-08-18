import { describe, expect, test } from "bun:test";
import { callsTo, makeAttempt, makeAutomationContext, makeTicket } from "../automation-context.fixture";
import { reviewTicketsCommand } from "./review-tickets";

const revision = (number: number, headSha: string) => ({ revision: number, headSha, reviews: [] });

describe("review-tickets automation", () => {
  test("reviews the oldest ready workspace revision instead of a ticket's first workspace", async () => {
    const { ctx, calls } = makeAutomationContext({
      tickets: [makeTicket({ id: "t1", shorthand: "T1", statusId: "in-review" })],
      attempts: [
        makeAttempt({
          workspaceId: "workspace-new",
          workspaceShorthand: "T1_A2",
          ticketId: "t1",
          ticketShorthand: "T1",
          state: "review_ready",
          revisions: [revision(1, "new-head")],
          updatedAt: "2026-06-02T00:00:00.000Z",
        }),
        makeAttempt({
          workspaceId: "workspace-old",
          workspaceShorthand: "T1_A1",
          ticketId: "t1",
          ticketShorthand: "T1",
          state: "review_ready",
          revisions: [revision(2, "old-head")],
          updatedAt: "2026-06-01T00:00:00.000Z",
        }),
      ],
    });

    const result = await reviewTicketsCommand.run(ctx as never);

    expect(result).toMatchObject({ reviewed: "T1", workspaceId: "workspace-old" });
    expect(callsTo(calls, "pstdio-planner.runReview")).toEqual([
      {
        commandId: "pstdio-planner.runReview",
        params: { workspaceId: "workspace-old", expectedRevision: 2 },
      },
    ]);
  });

  test("does not re-review approved revisions or tickets waiting for a human", async () => {
    const { ctx, calls } = makeAutomationContext({
      tickets: [
        makeTicket({
          id: "t1",
          shorthand: "T1",
          statusId: "in-review",
          tagIds: ["default-human-requested-true"],
        }),
        makeTicket({ id: "t2", shorthand: "T2", statusId: "in-review" }),
      ],
      attempts: [
        makeAttempt({
          workspaceId: "workspace-1",
          ticketId: "t1",
          state: "review_ready",
          revisions: [revision(1, "head-1")],
        }),
        makeAttempt({
          workspaceId: "workspace-2",
          ticketId: "t2",
          state: "approved",
          revisions: [revision(1, "head-2")],
        }),
      ],
    });

    const result = await reviewTicketsCommand.run(ctx as never);

    expect(result).toMatchObject({ reviewed: null });
    expect(callsTo(calls, "pstdio-planner.runReview")).toEqual([]);
  });

  test("reconciles a running review without starting another round", async () => {
    const { ctx, calls } = makeAutomationContext({
      tickets: [makeTicket({ id: "t1", shorthand: "T1", statusId: "in-review" })],
      attempts: [
        makeAttempt({
          workspaceId: "workspace-1",
          ticketId: "t1",
          state: "reviewing",
          revisions: [revision(1, "head-1")],
        }),
      ],
      reconcileDecisions: { "workspace-1": "active" },
    });

    const result = await reviewTicketsCommand.run(ctx as never);

    expect(result).toMatchObject({
      reviewed: null,
      reconciled: [{ workspaceId: "workspace-1", decision: "active" }],
    });
    expect(callsTo(calls, "pstdio-planner.runReview")).toEqual([]);
  });
});
