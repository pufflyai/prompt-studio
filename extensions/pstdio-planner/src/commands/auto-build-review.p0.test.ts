import { expect, test } from "bun:test";
import { listAttempts, putAttempt } from "../data/attempt-storage";
import { putTicket } from "../data/ticket-context.fixture";

import { fixture } from "./auto-build.fixture";
import { autoBuildCandidatesCommand } from "./auto-build-candidates";
import { autoBuildDispatchCommand } from "./auto-build-dispatch";
import { configureAutoBuildCommand, readAutoBuildCommand } from "./auto-build-mode";
import { runAttemptCommand } from "./run-attempt";
import { sessionRecord } from "./session-record.fixture";

async function reviewDependency() {
  const { ctx, storage, ticket } = await fixture();
  const parent = await ticket("Parent");
  const child = await ticket("Child", [parent.id]);
  const started = await runAttemptCommand.run(ctx, { ticket: parent.id });
  await putAttempt(storage, {
    ...started.attempt,

    revisions: [
      {
        revision: 1,
        baseSha: "main-sha",
        headSha: "parent-head",
        changeRequestReportId: "report",
        submittedAt: new Date().toISOString(),
        submittedBy: { type: "agent", id: "agent", displayName: "Agent" },
        reviews: [],
      },
    ],
  });
  await putTicket(storage, { ...parent, statusId: "in-review" });
  ctx.sessions.get = async (id) => sessionRecord({ id, title: "Parent", status: "completed" });
  return { ctx, storage, parent, child, started };
}

test("Auto Build uses committed dependency handoffs without a second managed review", async () => {
  const { ctx, child } = await reviewDependency();
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ requireMergedDependencies: false });
  expect((await autoBuildCandidatesCommand.run(ctx, {})).candidates.map(({ id }) => id)).toContain(child.id);
  expect(await autoBuildDispatchCommand.run(ctx, { ticket: child.id, revision: "test" })).toMatchObject({
    decision: "started",
  });
});

test("turning review blocking off launches children on submitted dependency commits", async () => {
  const { ctx, storage, child, started } = await reviewDependency();
  const bases: unknown[] = [];
  const create = ctx.workspaces.create;
  ctx.workspaces.create = async (input) => {
    bases.push(input.params?.base);
    return create(input);
  };
  const mode = await configureAutoBuildCommand.run(ctx, { enabled: true, blockOnReview: false });
  expect((await autoBuildCandidatesCommand.run(ctx, {})).candidates.map(({ id }) => id)).toEqual([child.id]);
  const result = await autoBuildDispatchCommand.run(ctx, { ticket: child.id, revision: mode.revision });
  expect(result.decision).toBe("started");
  expect(bases).toEqual(["parent-head"]);
  const childAttempt = (await listAttempts(storage)).find(({ ticketId }) => ticketId === child.id);
  expect(childAttempt?.base).toEqual({ workspaceId: started.workspace.id, headSha: "parent-head" });
  await configureAutoBuildCommand.run(ctx, { enabled: false });
  expect(await configureAutoBuildCommand.run(ctx, { enabled: true })).toMatchObject({ blockOnReview: false });
});

test("active replacement execution prevents stacking on an earlier handoff", async () => {
  const { ctx, storage, child, started } = await reviewDependency();
  const attempt = (await listAttempts(storage)).find(({ workspaceId }) => workspaceId === started.workspace.id)!;
  await putAttempt(storage, attempt);
  ctx.sessions.get = async (id) => ({ id, title: "Replacement", status: "in_progress" }) as never;
  await configureAutoBuildCommand.run(ctx, { enabled: true, blockOnReview: false });
  expect((await autoBuildCandidatesCommand.run(ctx, {})).candidates.some(({ id }) => id === child.id)).toBe(false);
});

test("idle Auto Build reports blocked work without flagging a finished board", async () => {
  const { ctx, storage, child } = await reviewDependency();
  ctx.sessions.get = async (id) => ({ id, title: "Replacement", status: "in_progress" }) as never;
  expect((await autoBuildCandidatesCommand.run(ctx, {})).candidates).toHaveLength(0);
  await putTicket(storage, { ...child, statusId: "done" });
  expect((await autoBuildCandidatesCommand.run(ctx, {})).candidates).toHaveLength(0);
});

test("a newer dependency revision during dispatch prevents starting on its stale commit", async () => {
  const { ctx, storage, child, started } = await reviewDependency();
  const mode = await configureAutoBuildCommand.run(ctx, { enabled: true, blockOnReview: false });
  const run = ctx.process.run;
  let checks = 0;
  ctx.process.run = async (input) => {
    if (input.command.includes("--verify") && ++checks === 2) {
      const parent = (await listAttempts(storage)).find(({ workspaceId }) => workspaceId === started.workspace.id)!;
      await putAttempt(storage, {
        ...parent,
        revisions: parent.revisions.map((revision) => ({ ...revision, headSha: "new-parent-head" })),
      });
    }
    return run(input);
  };
  await expect(autoBuildDispatchCommand.run(ctx, { ticket: child.id, revision: mode.revision })).rejects.toThrow(
    "dependency revision changed",
  );
  expect((await listAttempts(storage)).some(({ ticketId }) => ticketId === child.id)).toBe(false);
});
