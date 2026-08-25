import { describe, expect, test } from "bun:test";
import { putAttempt } from "../data/attempt-storage";
import { createMemoryStorage } from "../data/memory-storage";
import { makeCommandArgs } from "./command-context.fixture";
import { runReviewCommand } from "./run-review";

describe("runReviewCommand", () => {
  test("marks created sessions as reviews so generic work tracking ignores them", async () => {
    const creates: unknown[] = [];
    const storage = createMemoryStorage();
    await putAttempt(storage, {
      schemaVersion: 1,
      workspaceId: "workspace-1",
      workspaceShorthand: "PS-7_A1",
      ticketId: "ticket-7",
      ticketShorthand: "PS-7",
      implementationSessionId: "implementation-1",
      state: "review_ready",
      base: { workspaceId: null, headSha: "base-sha" },
      revisions: [
        {
          revision: 1,
          baseSha: "base-sha",
          headSha: "head-sha",
          changeRequestReportId: "change-report-1",
          submittedAt: "2026-08-18T10:00:00.000Z",
          submittedBy: { type: "agent", id: "agent-1", displayName: "Agent" },
          reviews: [],
        },
      ],
      implementationDisconnectRetries: 0,
      reviewDisconnectRetries: 0,
      blocker: null,
      createdAt: "2026-08-18T09:00:00.000Z",
      updatedAt: "2026-08-18T10:00:00.000Z",
    });

    await runReviewCommand.run(
      ...makeCommandArgs({
        storage,
        params: { workspaceId: "workspace-1" },
        overrides: {
          sessions: {
            create: async (input: unknown) => {
              creates.push(input);
              return { id: "session-1" };
            },
          } as never,
        },
      }),
    );

    expect(creates).toEqual([
      expect.objectContaining({
        workspaceId: "workspace-1",
        anchors: expect.arrayContaining([
          expect.objectContaining({
            type: "planner-review",
            metadata: {
              headSha: "head-sha",
              phase: "review",
              revision: 1,
              ticketId: "ticket-7",
              workspaceId: "workspace-1",
            },
          }),
          expect.objectContaining({ type: "planner-attempt", id: "workspace-1" }),
        ]),
      }),
    ]);
  });

  test("starts at most one automatic review for a ready revision", async () => {
    const storage = createMemoryStorage();
    await putAttempt(storage, {
      schemaVersion: 1,
      workspaceId: "workspace-1",
      workspaceShorthand: "PS-7_A1",
      ticketId: "ticket-7",
      ticketShorthand: "PS-7",
      implementationSessionId: "implementation-1",
      state: "review_ready",
      base: { workspaceId: null, headSha: "base-sha" },
      revisions: [
        {
          revision: 1,
          baseSha: "base-sha",
          headSha: "head-sha",
          changeRequestReportId: "change-report-1",
          submittedAt: "2026-08-18T10:00:00.000Z",
          submittedBy: { type: "agent", id: "agent-1", displayName: "Agent" },
          reviews: [],
        },
      ],
      implementationDisconnectRetries: 0,
      reviewDisconnectRetries: 0,
      blocker: null,
      createdAt: "2026-08-18T09:00:00.000Z",
      updatedAt: "2026-08-18T10:00:00.000Z",
    });
    let createCount = 0;
    const context = () =>
      makeCommandArgs({
        storage,
        params: { workspaceId: "workspace-1" },
        overrides: {
          sessions: {
            create: async () => ({ id: `session-${++createCount}` }),
          } as never,
        },
      });

    const results = await Promise.allSettled([runReviewCommand.run(...context()), runReviewCommand.run(...context())]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(createCount).toBe(1);
  });
});
