import { expect, test } from "bun:test";
import { listAttempts, putAttempt } from "../data/attempt-storage";
import { readAutoBuildMode } from "../data/auto-build-mode";
import { putTicket } from "../data/collections";
import { readImplementationCapacity } from "./attempt-readiness";
import { fixture } from "./auto-build.fixture";
import { readAutoBuildCandidates } from "./auto-build-candidates";
import { autoBuildDispatchCommand } from "./auto-build-dispatch";
import { autoBuildScopeCommand } from "./auto-build-scope";
import { runAttemptCommand } from "./run-attempt";
import { sessionQuery } from "./session-query.fixture";

test("unrelated ticket edits cannot wake resolved scope and live handoff owners retain capacity", async () => {
  const { ctx, storage, ticket } = await fixture();
  const included = await ticket("Included");
  const other = { ...(await ticket("Outside scope")), statusId: "backlog" };
  await putTicket(storage, other);
  const mode = await readAutoBuildMode(ctx);
  await autoBuildScopeCommand.run(ctx, { revision: mode.revision, queries: [{ status: "ready" }] });
  const first = await readAutoBuildCandidates(ctx, mode);
  await putTicket(storage, { ...other, title: "Unrelated edit" });
  expect((await readAutoBuildCandidates(ctx, mode)).snapshot).toBe(first.snapshot);
  const started = await runAttemptCommand.run(ctx, { ticket: included.id });
  await putAttempt(storage, {
    ...started.variant,
    revisions: [
      {
        revision: 1,
        baseSha: "main-sha",
        headSha: "head",
        changeRequestReportId: "report",
        submittedAt: new Date().toISOString(),
        submittedBy: { type: "agent", id: "owner", displayName: "Owner" },
        reviews: [],
      },
    ],
  });
  expect(await readImplementationCapacity(ctx)).toMatchObject({ running: 1 });
});

test("unexpected execution after submission recovers once while explicit stop remains stopped", async () => {
  const { ctx, storage, ticket } = await fixture();
  const task = await ticket("Recover");
  const started = await runAttemptCommand.run(ctx, { ticket: task.id });
  await putAttempt(storage, {
    ...started.variant,
    revisions: [
      {
        revision: 1,
        baseSha: "main-sha",
        headSha: "head",
        changeRequestReportId: "report",
        submittedAt: new Date().toISOString(),
        submittedBy: { type: "agent", id: "owner", displayName: "Owner" },
        reviews: [],
      },
    ],
  });
  let cause = "user_stop";
  ctx.sessions.get = async (id) =>
    ({
      id,
      title: "Owner",
      status: "cancelled",
      last_exit: { cause, startedAt: null, endedAt: "2026-10-13T09:00:00Z" },
    }) as never;
  const mode = await readAutoBuildMode(ctx);
  expect((await readAutoBuildCandidates(ctx, mode)).candidates).toHaveLength(0);
  cause = "request_aborted";
  expect((await readAutoBuildCandidates(ctx, mode)).candidates).toMatchObject([{ id: task.id, action: "resume" }]);
  const followups: string[] = [];
  ctx.sessions.followup = async ({ sessionId }) => {
    followups.push(sessionId);
  };
  await autoBuildDispatchCommand.run(ctx, { ticket: task.id, revision: mode.revision });
  expect(followups).toEqual([started.session.id]);
  expect((await listAttempts(storage))[0]?.implementationDisconnectRetries).toBe(1);
  expect((await readAutoBuildCandidates(ctx, mode)).candidates).toHaveLength(0);
});

test("ordinary workspace writers and full capacity prevent automatic recovery", async () => {
  const { ctx, storage, ticket } = await fixture(1);
  const task = await ticket("Recover owner");
  const started = await runAttemptCommand.run(ctx, { ticket: task.id });
  ctx.sessions.get = async (id) => ({ id, title: id, status: "disconnected" }) as never;
  ctx.sessions.query = sessionQuery(
    async () => [],
    async () => [{ id: "ordinary", title: "Ordinary task", status: "in_progress" }],
  );
  const mode = await readAutoBuildMode(ctx);
  const competing = await readAutoBuildCandidates(ctx, mode);
  expect(competing.candidates).toHaveLength(0);
  expect(competing.observations).toMatchObject([{ reason: "Another session is executing in this workspace." }]);
  ctx.sessions.query = sessionQuery(async () => []);
  const other = await ticket("Uses the slot");
  ctx.sessions.get = async (id) =>
    ({ id, title: id, status: id === started.session.id ? "disconnected" : "in_progress" }) as never;
  await runAttemptCommand.run(ctx, { ticket: other.id });
  expect(await autoBuildDispatchCommand.run(ctx, { ticket: task.id, revision: mode.revision })).toMatchObject({
    decision: "wait",
    reason: "capacity-full",
  });
  expect(
    (await listAttempts(storage)).find((a) => a.workspaceId === started.workspace.id)?.implementationDisconnectRetries,
  ).toBe(0);
});

test("failed execution after a recorded handoff remains visibly unfinished", async () => {
  const { ctx, storage, ticket } = await fixture();
  const task = await ticket("Failed CI owner");
  const started = await runAttemptCommand.run(ctx, { ticket: task.id });
  await putAttempt(storage, {
    ...started.variant,
    revisions: [
      {
        revision: 1,
        baseSha: "main-sha",
        headSha: "head",
        changeRequestReportId: "report",
        submittedAt: new Date().toISOString(),
        submittedBy: { type: "agent", id: "owner", displayName: "Owner" },
        reviews: [],
      },
    ],
  });
  ctx.sessions.get = async (id) => ({ id, title: id, status: "failed" }) as never;
  const result = await readAutoBuildCandidates(ctx, await readAutoBuildMode(ctx));
  expect(result.candidates).toHaveLength(0);
  expect(result.observations).toMatchObject([{ reason: "The owner execution failed." }]);
});
