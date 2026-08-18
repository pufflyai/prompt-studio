import { describe, expect, test } from "bun:test";
import { ATTEMPTS_COLLECTION, putAttempt, readAttempt, reviewLaunchClaimsCollection } from "../data/attempt-storage";
import type { AttemptRecord } from "../data/attempt-types";
import { putTicket, ticketsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import { seedDefaultStatuses, seedDefaultTags } from "../data/seed";
import { makeCommandContext } from "./command-context.fixture";
import { reconcileAttemptCommand } from "./reconcile-attempt";
import { runReviewCommand } from "./run-review";

const baseAttempt = (state: AttemptRecord["state"]): AttemptRecord => ({
  schemaVersion: 1,
  workspaceId: "workspace-1",
  workspaceShorthand: "PS-1_A1",
  ticketId: "ticket-1",
  ticketShorthand: "PS-1",
  implementationSessionId: "implementation-1",
  state,
  base: { workspaceId: null, headSha: "base-sha" },
  revisions: [],
  implementationDisconnectRetries: 0,
  reviewDisconnectRetries: 0,
  blocker: null,
  createdAt: "2026-08-18T09:00:00.000Z",
  updatedAt: "2026-08-18T09:00:00.000Z",
});

const setup = async (attempt: AttemptRecord, statuses: Record<string, string>) => {
  const storage = createMemoryStorage();
  await Promise.all([seedDefaultStatuses(storage), seedDefaultTags(storage)]);
  await putTicket(storage, {
    id: "ticket-1",
    shorthand: "PS-1",
    title: "Ticket",
    content: "# Ticket",
    statusId: "in-progress",
    tagIds: [],
    archived: false,
    sortOrder: 0,
    createdAt: "2026-08-18T09:00:00.000Z",
    updatedAt: "2026-08-18T09:00:00.000Z",
  });
  await putAttempt(storage, attempt);
  const followups: unknown[] = [];
  const sessions: unknown[] = [];
  const ctx = makeCommandContext({
    storage,
    params: { workspaceId: "workspace-1" },
    overrides: {
      source: "automation",
      invocationId: "reconcile-1",
      sessions: {
        get: async (id: string) => ({ id, title: id, status: statuses[id] ?? "completed", anchors_json: [] }),
        followup: async (input: unknown) => {
          followups.push(input);
        },
        addAnchors: async () => {},
        create: async (input: unknown) => {
          sessions.push(input);
          return { type: "session", id: "review-retry-1", title: "Retry", status: "in_progress" };
        },
      } as never,
    } as never,
  });
  return { storage, ctx, followups, sessions };
};

describe("reconcileAttemptCommand", () => {
  test("resumes the same implementation session once after a disconnect", async () => {
    const fixture = await setup(baseAttempt("implementing"), { "implementation-1": "disconnected" });

    const result = await reconcileAttemptCommand.run(fixture.ctx);

    expect(result.decision).toBe("implementation-retried");
    expect((await readAttempt(fixture.storage, "workspace-1"))?.implementationDisconnectRetries).toBe(1);
    expect(fixture.followups).toEqual([expect.objectContaining({ sessionId: "implementation-1" })]);
  });

  test("blocks only the attempt and requests a human after the second disconnect", async () => {
    const attempt = { ...baseAttempt("implementing"), implementationDisconnectRetries: 1 };
    const fixture = await setup(attempt, { "implementation-1": "disconnected" });

    const result = await reconcileAttemptCommand.run(fixture.ctx);

    expect(result.decision).toBe("blocked");
    expect((await readAttempt(fixture.storage, "workspace-1"))?.blocker).toMatchObject({
      phase: "implementation",
      sessionId: "implementation-1",
      retryCount: 1,
    });
    expect((await ticketsCollection(fixture.storage).get("ticket-1"))?.tagIds).toContain(
      "default-human-requested-true",
    );
  });

  test("creates a linked review round when retrying a disconnected review", async () => {
    const attempt = baseAttempt("reviewing");
    attempt.revisions = [
      {
        revision: 1,
        baseSha: "base-sha",
        headSha: "head-sha",
        changeRequestReportId: "change-report-1",
        submittedAt: "2026-08-18T10:00:00.000Z",
        submittedBy: { type: "agent", id: "agent-1", displayName: "Agent" },
        reviews: [
          {
            id: "review-1",
            sessionId: "review-session-1",
            reportId: null,
            reviewedHeadSha: "head-sha",
            reviewer: { type: "agent", id: "reviewer-1", displayName: "Reviewer" },
            state: "started",
            verdict: null,
            startedAt: "2026-08-18T11:00:00.000Z",
            completedAt: null,
            supersedesReviewId: null,
          },
        ],
      },
    ];
    const fixture = await setup(attempt, { "review-session-1": "disconnected" });

    const result = await reconcileAttemptCommand.run(fixture.ctx);

    expect(result.decision).toBe("review-retried");
    const reviews = (await readAttempt(fixture.storage, "workspace-1"))?.revisions[0]?.reviews ?? [];
    expect(reviews).toEqual([
      expect.objectContaining({ id: "review-1", state: "disconnected" }),
      expect.objectContaining({ sessionId: "review-retry-1", state: "started", supersedesReviewId: "review-1" }),
    ]);
    expect(fixture.sessions).toEqual([expect.objectContaining({ originalSessionId: "review-session-1" })]);
  });

  test("reattaches one retry session when persistence fails after launch", async () => {
    const attempt = baseAttempt("reviewing");
    attempt.revisions = [
      {
        revision: 1,
        baseSha: "base-sha",
        headSha: "head-sha",
        changeRequestReportId: "change-report-1",
        submittedAt: "2026-08-18T10:00:00.000Z",
        submittedBy: { type: "agent", id: "agent-1", displayName: "Agent" },
        reviews: [
          {
            id: "review-1",
            sessionId: "review-session-1",
            reportId: null,
            reviewedHeadSha: "head-sha",
            reviewer: { type: "agent", id: "reviewer-1", displayName: "Reviewer" },
            state: "started",
            verdict: null,
            startedAt: "2026-08-18T11:00:00.000Z",
            completedAt: null,
            supersedesReviewId: null,
          },
        ],
      },
    ];
    const fixture = await setup(attempt, { "review-session-1": "disconnected" });
    const originalCollection = fixture.storage.collection.bind(fixture.storage);
    let failNextAttemptPut = false;
    fixture.storage.collection = ((name: string) => {
      const collection = originalCollection(name);
      if (name !== ATTEMPTS_COLLECTION) return collection;
      return {
        ...collection,
        put: async (id: string, value: unknown) => {
          if (failNextAttemptPut) {
            failNextAttemptPut = false;
            throw new Error("transient attempt persistence failure");
          }
          await collection.put(id, value);
        },
      };
    }) as typeof fixture.storage.collection;
    const create = fixture.ctx.sessions.create.bind(fixture.ctx.sessions);
    fixture.ctx.sessions.create = async (input) => {
      const session = await create(input);
      failNextAttemptPut = true;
      return session;
    };
    fixture.ctx.sessions.listByWorkspace = async () =>
      fixture.sessions.map((input, index) => ({
        id: `review-retry-${index + 1}`,
        title: "Retry",
        status: "in_progress" as const,
        anchors_json: (input as { anchors?: [] }).anchors ?? [],
      }));

    await expect(reconcileAttemptCommand.run(fixture.ctx)).rejects.toThrow("transient attempt persistence failure");
    expect((await readAttempt(fixture.storage, "workspace-1"))?.revisions[0]?.reviews.at(-1)).toMatchObject({
      sessionId: null,
      state: "started",
      supersedesReviewId: "review-1",
    });

    const reconciled = await reconcileAttemptCommand.run(fixture.ctx);

    expect(reconciled.decision).toBe("review-reattached");
    expect(fixture.sessions).toHaveLength(1);
    expect((await readAttempt(fixture.storage, "workspace-1"))?.revisions[0]?.reviews.at(-1)?.sessionId).toBe(
      "review-retry-1",
    );
  });

  test("releases a failed review claim so the revision can be reviewed again", async () => {
    const attempt = baseAttempt("reviewing");
    attempt.revisions = [
      {
        revision: 1,
        baseSha: "base-sha",
        headSha: "head-sha",
        changeRequestReportId: "change-report-1",
        submittedAt: "2026-08-18T10:00:00.000Z",
        submittedBy: { type: "agent", id: "agent-1", displayName: "Agent" },
        reviews: [
          {
            id: "review-1",
            sessionId: "review-session-1",
            reportId: null,
            reviewedHeadSha: "head-sha",
            reviewer: { type: "agent", id: "reviewer-1", displayName: "Reviewer" },
            state: "started",
            verdict: null,
            startedAt: "2026-08-18T11:00:00.000Z",
            completedAt: null,
            supersedesReviewId: null,
          },
        ],
      },
    ];
    const fixture = await setup(attempt, { "review-session-1": "completed" });
    await reviewLaunchClaimsCollection(fixture.storage).put("workspace-1:1", {
      workspaceId: "workspace-1",
      revision: 1,
      reviewId: "review-1",
      createdAt: "2026-08-18T11:00:00.000Z",
    });

    const reconciled = await reconcileAttemptCommand.run(fixture.ctx);
    const restarted = await runReviewCommand.run(fixture.ctx);

    expect(reconciled.decision).toBe("review-missing-verdict");
    expect(restarted.review.state).toBe("started");
  });

  test("releases the original claim when a replacement review fails", async () => {
    const attempt = baseAttempt("reviewing");
    attempt.revisions = [
      {
        revision: 1,
        baseSha: "base-sha",
        headSha: "head-sha",
        changeRequestReportId: "change-report-1",
        submittedAt: "2026-08-18T10:00:00.000Z",
        submittedBy: { type: "agent", id: "agent-1", displayName: "Agent" },
        reviews: [
          {
            id: "review-1",
            sessionId: "review-session-1",
            reportId: null,
            reviewedHeadSha: "head-sha",
            reviewer: { type: "agent", id: "reviewer-1", displayName: "Reviewer" },
            state: "started",
            verdict: null,
            startedAt: "2026-08-18T11:00:00.000Z",
            completedAt: null,
            supersedesReviewId: null,
          },
        ],
      },
    ];
    const fixture = await setup(attempt, {
      "review-session-1": "disconnected",
      "review-retry-1": "completed",
    });
    await reviewLaunchClaimsCollection(fixture.storage).put("workspace-1:1", {
      workspaceId: "workspace-1",
      revision: 1,
      reviewId: "review-1",
      createdAt: "2026-08-18T11:00:00.000Z",
    });

    const retried = await reconcileAttemptCommand.run(fixture.ctx);
    const reconciled = await reconcileAttemptCommand.run(fixture.ctx);
    const restarted = await runReviewCommand.run(fixture.ctx);

    expect(retried.decision).toBe("review-retried");
    expect(reconciled.decision).toBe("review-missing-verdict");
    expect(restarted.review.state).toBe("started");
  });
});
