import { expect, test } from "bun:test";
import { putAttempt, readAttempt } from "../data/attempt-storage";
import { autoBuildDispatchCommand } from "./auto-build-dispatch";
import { configureAutoBuildCommand } from "./auto-build-mode";
import { submitChangeRequestCommand } from "./change-requests";
import { nextTicketsCommand } from "./next-tickets";
import { sessionQuery } from "./session-query.fixture";
import { expectProcessFailure, stackSubmissionFixture } from "./stack-submission.fixture";
import { readStackRepair, updateStackCommand } from "./update-stack";

async function staleStack() {
  const f = await stackSubmissionFixture();
  await f.ticket("Parent");
  await f.ticket("Child", ["Parent"]);
  const oldParent = await f.commit("parent.txt");
  await f.git("checkout", "-b", "child");
  const head = await f.commit("child.txt");
  await f.git("checkout", "main");
  const parent = await f.commit("parent-update.txt");
  await f.git("checkout", "child");
  await putAttempt(f.storage, { ...f.attempt, base: { workspaceId: "parent", headSha: oldParent } });
  await putAttempt(f.storage, {
    ...f.attempt,
    workspaceId: "parent",
    ticketId: "Parent",
    revisions: [
      {
        revision: 1,
        baseSha: f.base,
        headSha: parent,
        changeRequestReportId: "parent-report",
        submittedAt: new Date().toISOString(),
        submittedBy: { type: "agent", id: "test", displayName: "Test" },
        reviews: [],
      },
    ],
  });
  return {
    ...f,
    head,
    parent,
    input: { workspaceId: "child", implementationSessionId: "owner", expectedHeadSha: head },
  };
}

test("owned stack update integrates current dependencies and preserves the ticket changes", async () => {
  const f = await staleStack();
  try {
    const result = await updateStackCommand.run(f.ctx, f.input);
    expect(await f.git("show", "HEAD:child.txt")).toBe("child.txt");
    expect(await f.git("show", "HEAD:parent-update.txt")).toBe("parent-update.txt");
    expect(result.base).toEqual({ workspaceId: "parent", headSha: f.parent });
    expect((await readAttempt(f.storage, "child"))?.base).toEqual(result.base);
    expect((await readAttempt(f.storage, "child"))?.revisions).toHaveLength(0);
  } finally {
    await f.cleanup();
  }
});

test("stack update refuses stale HEAD or another active workspace writer", async () => {
  const f = await staleStack();
  try {
    await expectProcessFailure(updateStackCommand.run(f.ctx, { ...f.input, expectedHeadSha: f.base }), "HEAD changed");
    f.ctx.sessions.query = sessionQuery(
      async () => [],
      async () => [
        { type: "session", id: "owner", title: "Owner", status: "completed" },
        { type: "session", id: "other", title: "Other", status: "in_progress" },
      ],
    );
    await expectProcessFailure(updateStackCommand.run(f.ctx, f.input), "Another session");
    expect(await f.git("rev-parse", "HEAD")).toBe(f.head);
  } finally {
    await f.cleanup();
  }
});

test("next tickets exposes stack recovery even when no new implementation can start", async () => {
  const f = await staleStack();
  try {
    const attempt = await readAttempt(f.storage, "child");
    await putAttempt(f.storage, {
      ...attempt!,
      revisions: [
        {
          revision: 1,
          baseSha: attempt!.base.headSha,
          headSha: f.head,
          changeRequestReportId: "old-report",
          submittedAt: new Date().toISOString(),
          submittedBy: { type: "agent", id: "test", displayName: "Test" },
          reviews: [],
        },
      ],
    });
    const next = await nextTicketsCommand.run(f.ctx, {});
    expect(next.tickets).toContainEqual(
      expect.objectContaining({ ticket: "Child", action: "update-stack", workspaceId: "child", baseHeadSha: f.parent }),
    );
  } finally {
    await f.cleanup();
  }
});

test("Auto Build assigns recovery to the existing implementation owner without a review-state transition", async () => {
  const f = await staleStack();
  try {
    const attempt = (await readAttempt(f.storage, "child"))!;
    await putAttempt(f.storage, {
      ...attempt,
      revisions: [
        {
          revision: 1,
          baseSha: attempt.base.headSha,
          headSha: f.head,
          changeRequestReportId: "old-report",
          submittedAt: new Date().toISOString(),
          submittedBy: { type: "agent", id: "test", displayName: "Test" },
          reviews: [],
        },
      ],
    });
    const calls: string[] = [];
    f.ctx.sessions.followup = async ({ sessionId }) => {
      calls.push(sessionId);
    };
    f.ctx.automation = { list: async () => [], enqueue: async () => ({}) } as never;
    const mode = await configureAutoBuildCommand.run(f.ctx, {
      enabled: true,
      prompt: "Finish Child",
      blockOnReview: false,
    });
    await f.storage.set("auto-build-supervisor", { sessionId: "supervisor" });
    const result = await autoBuildDispatchCommand.run(f.ctx, { ticket: "Child", revision: mode.revision });
    expect(result).toMatchObject({ decision: "started", sessionId: "owner", workspaceId: "child" });
    expect(calls).toEqual(["owner"]);
    expect((await nextTicketsCommand.run(f.ctx, {})).tickets).toHaveLength(0);
  } finally {
    await f.cleanup();
  }
});

test("an owner can realign and submit a root after rebasing to another target", async () => {
  const f = await stackSubmissionFixture({ trace: true });
  try {
    const oldBase = await f.commit("old-target.txt");
    await putAttempt(f.storage, { ...f.attempt, base: { workspaceId: null, headSha: oldBase } });
    await f.git("checkout", "-b", "child");
    await f.commit("child.txt");
    await f.git("checkout", "-b", "target", f.base);
    const target = await f.commit("target.txt");
    await f.git("checkout", "child");
    await f.git("rebase", "--onto", "target", oldBase);
    const head = await f.git("rev-parse", "HEAD");
    await putAttempt(f.storage, {
      ...f.attempt,
      base: { workspaceId: null, headSha: oldBase },
      revisions: [
        {
          revision: 1,
          baseSha: oldBase,
          headSha: head,
          changeRequestReportId: "old-report",
          submittedAt: new Date().toISOString(),
          submittedBy: { type: "agent", id: "test", displayName: "Test" },
          reviews: [],
        },
      ],
    });
    await expectProcessFailure(submitChangeRequestCommand.run(f.ctx, await f.params()), "recorded base");
    const result = await updateStackCommand.run(f.ctx, {
      workspaceId: "child",
      implementationSessionId: "owner",
      expectedHeadSha: head,
      base: "target",
    });
    expect(result.base).toEqual({ workspaceId: null, headSha: target });
    expect(result.headSha).toBe(head);
    expect(await readStackRepair(f.ctx, (await readAttempt(f.storage, "child"))!, {})).toMatchObject({
      headSha: head,
      base: { workspaceId: null, headSha: target },
      needsIntegration: false,
    });
    const submitted = await submitChangeRequestCommand.run(f.ctx, await f.params());
    expect(submitted.revisions).toHaveLength(2);
    expect(submitted.revisions[0]?.baseSha).toBe(oldBase);
    expect(submitted.revisions.at(-1)?.baseSha).toBe(target);
    expect(submitted.revisions.at(-1)?.headSha).toBe(head);
    expect(await f.git("show", "HEAD:child.txt")).toBe("child.txt");
  } finally {
    await f.cleanup();
  }
});
