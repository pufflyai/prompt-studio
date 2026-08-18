import { describe, expect, test } from "bun:test";
import { putAttempt, readAttempt, reviewCommentsCollection, reviewThreadsCollection } from "../data/attempt-storage";
import type { AttemptRecord } from "../data/attempt-types";
import { putTicket, ticketsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import { seedDefaultStatuses, seedDefaultTags } from "../data/seed";
import {
  addReviewCommentCommand,
  dismissReviewCommand,
  readAttemptHistoryCommand,
  readReviewThreadCommand,
  resolveReviewThreadCommand,
} from "./attempt-history";
import { submitChangeRequestCommand } from "./change-requests";
import { makeCommandContext } from "./command-context.fixture";
import { runReviewCommand } from "./run-review";
import { submitReviewCommand } from "./submit-review";

const actor = { type: "agent" as const, id: "agent-1", displayName: "Agent" };

const setup = async () => {
  const storage = createMemoryStorage();
  await Promise.all([seedDefaultStatuses(storage), seedDefaultTags(storage)]);
  const timestamp = "2026-08-18T09:00:00.000Z";
  await putTicket(storage, {
    id: "ticket-1",
    shorthand: "PS-1",
    title: "Attempt workflow",
    content: "# Attempt workflow",
    statusId: "in-progress",
    tagIds: [],
    attachments: [],
    parentId: null,
    dependsOn: [],
    blockedReason: null,
    userPrompt: null,
    parallelizable: "yes",
    draft: false,
    archived: false,
    sortOrder: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const attempt: AttemptRecord = {
    schemaVersion: 1,
    workspaceId: "workspace-1",
    workspaceShorthand: "PS-1_A1",
    ticketId: "ticket-1",
    ticketShorthand: "PS-1",
    implementationSessionId: "implementation-1",
    state: "implementing",
    base: { workspaceId: null, headSha: "base-sha" },
    revisions: [],
    implementationDisconnectRetries: 0,
    reviewDisconnectRetries: 0,
    blocker: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await putAttempt(storage, attempt);

  const followups: unknown[] = [];
  const addedAnchors: unknown[] = [];
  let createdSessions = 0;
  const context = (params: Record<string, unknown>, headSha = "head-sha") =>
    makeCommandContext({
      storage,
      params,
      overrides: {
        source: "cli",
        invocationId: "agent-1",
        commands: {
          execute: async (_command: string, invocation: { params?: unknown }) => {
            const id = (invocation.params as { id: string }).id;
            return {
              ok: true,
              status: "success",
              value: { id, workspaceId: "workspace-1", draft: false },
            };
          },
        },
        workspaces: {
          get: async () => ({ id: "workspace-1", workspace_shorthand: "PS-1_A1", worktree_path: "/workspace" }),
        },
        process: {
          run: async () => ({ exitCode: 0, stdout: `${headSha}\n`, stderr: "" }),
        },
        sessions: {
          get: async (id: string) => ({
            id,
            title: id,
            status: "completed",
            anchors_json: [{ type: "planner-attempt", id: "workspace-1" }],
          }),
          create: async () => ({
            type: "session",
            id: `review-session-${++createdSessions}`,
            title: "Review",
            status: "in_progress",
          }),
          followup: async (input: unknown) => {
            followups.push(input);
          },
          addAnchors: async (sessionId: string, anchors: unknown[]) => {
            addedAnchors.push({ sessionId, anchors });
          },
        },
      } as never,
    });

  return { storage, context, followups, addedAnchors };
};

const submitRevisionAndStartReview = async (fixture: Awaited<ReturnType<typeof setup>>) => {
  await submitChangeRequestCommand.run(
    fixture.context({
      workspaceId: "workspace-1",
      implementationSessionId: "implementation-1",
      headSha: "head-sha",
      changeRequestReportId: "change-report-1",
      expectedAttemptState: "implementing",
    }) as never,
  );
  const started = await runReviewCommand.run(fixture.context({ workspaceId: "workspace-1", expectedRevision: 1 }));
  return started;
};

describe("attempt workflow commands", () => {
  test("rejects malformed review threads before changing attempt state", async () => {
    const fixture = await setup();
    const started = await submitRevisionAndStartReview(fixture);

    await expect(
      submitReviewCommand.run(
        fixture.context({
          workspaceId: "workspace-1",
          reviewId: started.review.id,
          reviewSessionId: started.session.id,
          reviewedHeadSha: "head-sha",
          reviewReportId: "review-report-1",
          verdict: "passed",
          expectedRevision: 1,
          threads: [{ severity: "critical", body: "Must be fixed" }],
        }) as never,
      ),
    ).rejects.toThrow("passed review cannot contain");
    expect((await readAttempt(fixture.storage, "workspace-1"))?.state).toBe("reviewing");
  });

  test("submits a revision and routes requested changes to its implementation session", async () => {
    const fixture = await setup();
    const started = await submitRevisionAndStartReview(fixture);

    const result = await submitReviewCommand.run(
      fixture.context({
        workspaceId: "workspace-1",
        reviewId: started.review.id,
        reviewSessionId: started.session.id,
        reviewedHeadSha: "head-sha",
        reviewReportId: "review-report-1",
        verdict: "changes_requested",
        expectedRevision: 1,
        threads: [
          {
            path: "src/example.ts",
            startLine: 4,
            endLine: 6,
            side: "head",
            severity: "critical",
            body: "Preserve the workflow invariant.",
          },
        ],
      }) as never,
    );

    expect(result.attempt.state).toBe("changes_requested");
    expect((await ticketsCollection(fixture.storage).get("ticket-1"))?.statusId).toBe("in-progress");
    expect(fixture.followups).toEqual([
      expect.objectContaining({ sessionId: "implementation-1", prompt: expect.stringContaining("review-report-1") }),
    ]);
    expect(await reviewThreadsCollection(fixture.storage).list()).toEqual([
      expect.objectContaining({
        reviewId: started.review.id,
        originalBaseSha: "base-sha",
        originalHeadSha: "head-sha",
        state: "open",
      }),
    ]);
    expect(await reviewCommentsCollection(fixture.storage).list()).toEqual([
      expect.objectContaining({ body: "Preserve the workflow invariant.", author: actor }),
    ]);

    const thread = (await reviewThreadsCollection(fixture.storage).list())[0]!;
    const initialComment = (await reviewCommentsCollection(fixture.storage).list())[0]!;
    const reply = await addReviewCommentCommand.run(
      fixture.context({
        workspaceId: "workspace-1",
        reviewId: started.review.id,
        threadId: thread.id,
        body: "I will preserve it.",
        replyToCommentId: initialComment.id,
      }) as never,
    );
    await addReviewCommentCommand.run(
      fixture.context({
        workspaceId: "workspace-1",
        reviewId: started.review.id,
        threadId: thread.id,
        body: "The fix is ready.",
        replyToCommentId: reply.id,
      }) as never,
    );
    const firstPage = await readReviewThreadCommand.run(fixture.context({ threadId: thread.id, limit: 2 }) as never);
    const secondPage = await readReviewThreadCommand.run(
      fixture.context({ threadId: thread.id, limit: 2, cursor: firstPage.nextCursor }) as never,
    );
    expect([...firstPage.comments, ...secondPage.comments].map((comment) => comment.id).sort()).toEqual(
      (await reviewCommentsCollection(fixture.storage).list()).map((comment) => comment.id).sort(),
    );
    expect(firstPage.nextCursor).not.toBeNull();
    expect(reply).toMatchObject({ author: actor, replyToCommentId: initialComment.id });

    await resolveReviewThreadCommand.run(
      fixture.context({ workspaceId: "workspace-1", reviewId: started.review.id, threadId: thread.id }) as never,
    );
    const dismissed = await dismissReviewCommand.run(
      fixture.context({ workspaceId: "workspace-1", reviewId: started.review.id, reason: "Superseded" }) as never,
    );
    expect(dismissed.state).toBe("review_ready");
    expect(dismissed.revisions[0]?.reviews[0]?.state).toBe("dismissed");
    expect((await reviewThreadsCollection(fixture.storage).get(thread.id))?.state).toBe("resolved");

    const history = await readAttemptHistoryCommand.run(
      fixture.context({ workspaceId: "workspace-1", limit: 2 }) as never,
    );
    expect(history.nextCursor).not.toBeNull();
    expect(history.events.every((event) => event.workspaceId === "workspace-1")).toBe(true);
    expect(JSON.stringify(history.events)).not.toContain("Preserve the workflow invariant");
  });

  test("approves one exact revision and creates an anchored human handoff", async () => {
    const fixture = await setup();
    const started = await submitRevisionAndStartReview(fixture);

    await submitReviewCommand.run(
      fixture.context({
        workspaceId: "workspace-1",
        reviewId: started.review.id,
        reviewSessionId: started.session.id,
        reviewedHeadSha: "head-sha",
        reviewReportId: "review-report-1",
        verdict: "passed",
        expectedRevision: 1,
        threads: [],
      }) as never,
    );

    expect((await readAttempt(fixture.storage, "workspace-1"))?.state).toBe("approved");
    const ticket = await ticketsCollection(fixture.storage).get("ticket-1");
    expect(ticket?.statusId).toBe("in-review");
    expect(ticket?.tagIds).toContain("default-human-requested-true");
    expect(fixture.addedAnchors).toEqual([
      expect.objectContaining({
        sessionId: "implementation-1",
        anchors: [expect.objectContaining({ type: "planner-human-request" })],
      }),
    ]);
    await expect(runReviewCommand.run(fixture.context({ workspaceId: "workspace-1" }))).rejects.toThrow(
      "not ready for review",
    );
  });
});
