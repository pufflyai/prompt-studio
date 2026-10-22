import { expect, test } from "bun:test";
import { loadAttemptReadiness } from "../commands/attempt-readiness";
import { stackSubmissionFixture } from "../commands/stack-submission.fixture";
import { gitMergedHook } from "../hooks/git-merged";
import { attemptEventsCollection, putAttempt } from "./attempt-storage";

test("a recorded squash merge satisfies code dependencies only in targets containing it", async () => {
  const f = await stackSubmissionFixture();
  try {
    await f.ticket("Parent");
    await f.ticket("Child", ["Parent"]);
    await f.git("checkout", "-b", "parent");
    const parentHead = await f.commit("parent.txt");
    await putAttempt(f.storage, {
      ...f.attempt,
      workspaceId: "parent",
      ticketId: "Parent",
      revisions: [
        {
          revision: 1,
          baseSha: f.base,
          headSha: parentHead,
          changeRequestReportId: "parent-report",
          submittedAt: new Date().toISOString(),
          submittedBy: { type: "agent", id: "parent-owner", displayName: "Owner" },
          reviews: [],
        },
      ],
    });
    await f.git("checkout", "main");
    await f.git("merge", "--squash", "parent");
    await f.git("commit", "-m", "Squash dependency");
    const squash = await f.git("rev-parse", "HEAD");
    await gitMergedHook.run(f.ctx as never, {
      projectId: f.ctx.projectId,
      repoPath: f.path,
      workspace: { id: "parent", anchors_json: [{ type: "ticket", id: "Parent" }] } as never,
    });
    expect(await attemptEventsCollection(f.storage).list()).toContainEqual(
      expect.objectContaining({ type: "attempt_merged", commitSha: squash, metadata: { headSha: parentHead } }),
    );
    expect((await loadAttemptReadiness(f.ctx, "Child", { base: "main" })).readiness).toMatchObject({
      mode: "main",
      dependencyAttemptIds: [],
    });
    await f.git("reset", "--hard", f.base);
    expect((await loadAttemptReadiness(f.ctx, "Child", { base: "main" })).readiness).toMatchObject({
      mode: "stacked",
      baseHeadSha: parentHead,
    });
  } finally {
    await f.cleanup();
  }
});
