import { expect, test } from "bun:test";
import { putAttempt, readAttempt } from "../data/attempt-storage";
import { ticketsCollection } from "../data/collections";
import { loadAttemptReadiness } from "./attempt-readiness";
import { submitChangeRequestCommand } from "./change-requests";
import { prepareDependencyBase } from "./dependency-base";
import { stackSubmissionFixture } from "./stack-submission.fixture";
import { readStackRepair, updateStackCommand } from "./update-stack";

async function independentDependencies(conflict = false) {
  const f = await stackSubmissionFixture();
  await f.ticket("Left");
  await f.ticket("Right");
  await f.ticket("Child", ["Left", "Right"]);
  await f.git("checkout", "-b", "left", f.base);
  const left = await f.commit(conflict ? "shared.txt" : "left.txt");
  await f.git("checkout", "-b", "right", f.base);
  if (conflict) {
    await Bun.write(`${f.path}/shared.txt`, "different dependency content");
    await f.git("add", "shared.txt");
    await f.git("commit", "-m", "Right dependency");
  }
  const right = conflict ? await f.git("rev-parse", "HEAD") : await f.commit("right.txt");
  await f.git("checkout", "-b", "child", f.base);
  const child = await f.commit("child.txt");
  for (const [ticketId, headSha] of [
    ["Left", left],
    ["Right", right],
  ]) {
    const ticket = (await ticketsCollection(f.storage).get(ticketId!))!;
    await ticketsCollection(f.storage).put(ticket.id, { ...ticket, statusId: "done" });
    await putAttempt(f.storage, {
      ...f.attempt,
      workspaceId: ticketId!,
      ticketId: ticketId!,
      ticketShorthand: ticketId!,
      state: "review_ready",
      revisions: [
        {
          revision: 1,
          baseSha: f.base,
          headSha: headSha!,
          changeRequestReportId: `${ticketId}-report`,
          submittedAt: new Date().toISOString(),
          submittedBy: { type: "agent", id: "owner", displayName: "Owner" },
          reviews: [],
        },
      ],
    });
  }
  return {
    ...f,
    left,
    right,
    child,
    input: { workspaceId: "child", implementationSessionId: "owner", expectedHeadSha: child },
  };
}

test("repairs an unsubmitted child from Done dependency branches without changing main", async () => {
  const f = await independentDependencies();
  try {
    expect(await readStackRepair(f.ctx, f.attempt)).toMatchObject({ needsIntegration: true });
    const updated = await updateStackCommand.run(f.ctx, f.input);
    expect(updated.base.workspaceId).toBeNull();
    await f.git("merge-base", "--is-ancestor", f.left, updated.base.headSha);
    await f.git("merge-base", "--is-ancestor", f.right, updated.base.headSha);
    expect(await f.git("show", "HEAD:left.txt")).toBe("left.txt");
    expect(await f.git("show", "HEAD:right.txt")).toBe("right.txt");
    expect(await f.git("show", "HEAD:child.txt")).toBe("child.txt");
    expect(await f.git("rev-parse", "main")).toBe(f.base);
    const submitted = await submitChangeRequestCommand.run(f.ctx, await f.params());
    expect(submitted.revisions.at(-1)?.baseSha).toBe(updated.base.headSha);
    expect(await readStackRepair(f.ctx, (await readAttempt(f.storage, "child"))!)).toBeNull();
  } finally {
    await f.cleanup();
  }
});

test("dependency conflicts leave the child's files, HEAD, and recorded base untouched", async () => {
  const f = await independentDependencies(true);
  try {
    await expect(updateStackCommand.run(f.ctx, f.input)).rejects.toThrow("conflict");
    expect(await f.git("rev-parse", "HEAD")).toBe(f.child);
    expect(await f.git("status", "--porcelain")).toBe("");
    expect((await readAttempt(f.storage, "child"))?.base.headSha).toBe(f.base);
    expect(await f.git("rev-parse", "main")).toBe(f.base);
  } finally {
    await f.cleanup();
  }
});

test("a combined base preserves delivered target code alongside an unmerged dependency", async () => {
  const f = await independentDependencies();
  try {
    await f.git("update-ref", "refs/heads/main", f.left);
    const { readiness } = await loadAttemptReadiness(f.ctx, "Child", { base: "main", dependencyReview: "submitted" });
    expect(readiness).toMatchObject({ decision: "ready", mode: "stacked", baseHeadSha: f.left, baseWorkspaceId: null });
    if (readiness.decision !== "ready") throw new Error("Expected a dependency base");
    const base = await prepareDependencyBase(f.ctx, readiness);
    await f.git("merge-base", "--is-ancestor", f.left, base.headSha);
    await f.git("merge-base", "--is-ancestor", f.right, base.headSha);
    expect(await f.git("rev-parse", "main")).toBe(f.left);
    expect(await f.git("rev-parse", "HEAD")).toBe(f.child);
  } finally {
    await f.cleanup();
  }
});
