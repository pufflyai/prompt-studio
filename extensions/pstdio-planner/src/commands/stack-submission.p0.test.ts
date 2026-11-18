import { expect, test } from "bun:test";
import { putAttempt, readAttempt } from "../data/attempt-storage";
import { dismissReviewCommand } from "./attempt-history";
import { loadAttemptDependencies } from "./attempt-readiness";
import { submitChangeRequestCommand } from "./change-requests";
import { reconcileAttemptCommand } from "./reconcile-attempt";
import { sessionQuery } from "./session-query.fixture";
import { sessionRecord } from "./session-record.fixture";
import { expectProcessFailure, stackSubmissionFixture } from "./stack-submission.fixture";

const actor = { type: "agent" as const, id: "test", displayName: "Test" };

test("submission rejects a branch that discarded its recorded base", async () => {
  const f = await stackSubmissionFixture();
  try {
    await f.git("checkout", "--orphan", "unrelated");
    await f.commit("unrelated.txt");
    await expectProcessFailure(submitChangeRequestCommand.run(f.ctx, await f.params()), "base");
    expect((await readAttempt(f.storage, "child"))?.revisions).toHaveLength(0);
  } finally {
    await f.cleanup();
  }
});

test("a correction after passed review preserves the old verdict and records a fresh revision", async () => {
  const f = await stackSubmissionFixture();
  try {
    const oldHead = await f.commit("first.txt");
    const old = {
      revision: 1,
      baseSha: f.base,
      headSha: oldHead,
      changeRequestReportId: "old-report",
      submittedAt: new Date().toISOString(),
      submittedBy: actor,
      reviews: [
        {
          id: "review",
          sessionId: "reviewer",
          reportId: "review-report",
          reviewedHeadSha: oldHead,
          reviewer: actor,
          state: "submitted" as const,
          verdict: "passed" as const,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          supersedesReviewId: null,
        },
      ],
    };
    await putAttempt(f.storage, { ...f.attempt, revisions: [old] });
    await f.commit("correction.txt");
    const result = await submitChangeRequestCommand.run(f.ctx, await f.params());
    expect(result.revisions).toHaveLength(2);
    expect(result.revisions[0]).toEqual(old);
    expect(result.revisions[1]?.reviews).toEqual([]);
  } finally {
    await f.cleanup();
  }
});

test("submission refuses stale upstream ancestry and records the new base after integration", async () => {
  const f = await stackSubmissionFixture();
  try {
    await f.ticket("Parent");
    await f.ticket("Child", ["Parent"]);
    const oldParent = await f.commit("parent-old.txt");
    await f.git("checkout", "-b", "child");
    await f.commit("child.txt");
    await f.git("checkout", "main");
    const newParent = await f.commit("parent-new.txt");
    await f.git("checkout", "child");
    await putAttempt(f.storage, { ...f.attempt, base: { workspaceId: "parent", headSha: oldParent } });
    await putAttempt(f.storage, {
      ...f.attempt,
      workspaceId: "parent",
      ticketId: "Parent",
      ticketShorthand: "Parent",
      revisions: [
        {
          revision: 1,
          baseSha: f.base,
          headSha: newParent,
          changeRequestReportId: "parent-report",
          submittedAt: new Date().toISOString(),
          submittedBy: actor,
          reviews: [],
        },
      ],
    });
    await expectProcessFailure(submitChangeRequestCommand.run(f.ctx, await f.params()), "dependencies");
    await f.git("merge", "--no-edit", newParent);
    const result = await submitChangeRequestCommand.run(f.ctx, await f.params());
    expect(result.revisions.at(-1)?.baseSha).toBe(newParent);
    expect(result.base).toEqual({ workspaceId: "parent", headSha: newParent });
  } finally {
    await f.cleanup();
  }
});

test("submission rejects an owner detached from the workspace", async () => {
  const f = await stackSubmissionFixture();
  try {
    f.ctx.sessions.query = sessionQuery(
      async () => [],
      async () => [],
    );
    await expectProcessFailure(submitChangeRequestCommand.run(f.ctx, await f.params()), "linked");
    expect((await readAttempt(f.storage, "child"))?.revisions).toHaveLength(0);
  } finally {
    await f.cleanup();
  }
});

test("active replacement work cannot provide a dependency revision", async () => {
  const f = await stackSubmissionFixture();
  try {
    await f.ticket("Parent");
    await f.ticket("Child", ["Parent"]);
    await putAttempt(f.storage, {
      ...f.attempt,
      workspaceId: "parent",
      ticketId: "Parent",
      revisions: [
        {
          revision: 1,
          baseSha: f.base,
          headSha: f.base,
          changeRequestReportId: "parent-report",
          submittedAt: new Date().toISOString(),
          submittedBy: actor,
          reviews: [],
        },
      ],
    });
    f.ctx.sessions.get = async (id) => sessionRecord({ id, title: id, status: "in_progress" });
    const result = await loadAttemptDependencies(f.ctx, "Child", {});
    expect(result.readiness).toMatchObject({
      decision: "wait",
      reason: "dependency-not-ready",
      dependencyIds: ["Parent"],
    });
  } finally {
    await f.cleanup();
  }
});

test("submission rejects a dependency revision that changes during validation", async () => {
  const f = await stackSubmissionFixture();
  try {
    await f.ticket("Parent");
    await f.ticket("Child", ["Parent"]);
    const first = await f.commit("parent-first.txt");
    const second = await f.commit("parent-second.txt");
    const parent = {
      ...f.attempt,
      workspaceId: "parent",
      ticketId: "Parent",
      revisions: [
        {
          revision: 1,
          baseSha: f.base,
          headSha: first,
          changeRequestReportId: "parent-report",
          submittedAt: new Date().toISOString(),
          submittedBy: actor,
          reviews: [],
        },
      ],
    };
    await putAttempt(f.storage, parent);
    const run = f.ctx.process.run;
    f.ctx.process.run = async (input) => {
      const result = await run(input);
      if (input.command.includes("merge-base") && input.command.at(-2) === first && input.command.at(-1) === second)
        await putAttempt(f.storage, { ...parent, revisions: [{ ...parent.revisions[0]!, headSha: second }] });
      return result;
    };
    await expectProcessFailure(submitChangeRequestCommand.run(f.ctx, await f.params()), "dependency revision changed");
    expect((await readAttempt(f.storage, "child"))?.revisions).toHaveLength(0);
  } finally {
    await f.cleanup();
  }
});

test("review dismissal and reconciliation cannot overwrite an in-flight revision", async () => {
  const f = await stackSubmissionFixture();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered!: () => void;
  const ready = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const execute = f.ctx.commands.execute;
  f.ctx.commands.execute = async (...args) => {
    entered();
    await held;
    return execute(...args);
  };
  try {
    await f.commit("change.txt");
    const submission = submitChangeRequestCommand.run(f.ctx, await f.params());
    await ready;
    await expectProcessFailure(
      dismissReviewCommand.run(f.ctx, { workspaceId: "child", reviewId: "old-review", reason: "outdated" }),
      "Another Planner write",
    );
    await expectProcessFailure(reconcileAttemptCommand.run(f.ctx, { workspaceId: "child" }), "Another Planner write");
    release();
    expect((await submission).revisions).toHaveLength(1);
  } finally {
    release();
    await f.cleanup();
  }
});

test("resubmitting a recorded revision still checks its current dependency ancestry", async () => {
  const f = await stackSubmissionFixture();
  try {
    await f.ticket("Parent");
    await f.ticket("Child", ["Parent"]);
    const oldParent = await f.commit("parent-old.txt");
    await f.git("checkout", "-b", "child");
    const head = await f.commit("child.txt");
    await putAttempt(f.storage, {
      ...f.attempt,
      base: { workspaceId: "parent", headSha: oldParent },
      revisions: [
        {
          revision: 1,
          baseSha: oldParent,
          headSha: head,
          changeRequestReportId: "report",
          submittedAt: new Date().toISOString(),
          submittedBy: actor,
          reviews: [],
        },
      ],
    });
    await f.git("checkout", "main");
    const parent = await f.commit("parent-new.txt");
    await f.git("checkout", "child");
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
          submittedBy: actor,
          reviews: [],
        },
      ],
    });
    await expectProcessFailure(submitChangeRequestCommand.run(f.ctx, await f.params()), "outdated dependencies");
  } finally {
    await f.cleanup();
  }
});
