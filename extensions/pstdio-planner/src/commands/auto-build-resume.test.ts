import { expect, test } from "bun:test";
import { attemptSelectionsCollection, listAttempts, putAttempt } from "../data/attempt-storage";
import { putTicket } from "../data/collections";
import { fixture } from "./auto-build.fixture";
import { autoBuildCandidatesCommand } from "./auto-build-candidates";
import { autoBuildDispatchCommand } from "./auto-build-dispatch";
import { requestHumanCommand } from "./review-requests";
import { runAttemptCommand } from "./run-attempt";

async function stoppedAttempt(status: string) {
  const context = await fixture(6);
  const task = await context.ticket("Resume unfinished work");
  const started = await runAttemptCommand.run(context.ctx, { ticket: task.id });
  let currentStatus = status;
  const followups: string[] = [];
  context.ctx.sessions.get = async (id) =>
    ({
      type: "session",
      id,
      title: "Implementation",
      status: currentStatus,
      updated_at: "2026-10-12T19:00:00.000Z",
    }) as never;
  context.ctx.sessions.followup = async ({ sessionId }) => {
    followups.push(sessionId);
    currentStatus = "in_progress";
    return {} as never;
  };
  return { ...context, task, started, followups };
}

test.each([
  "completed",
  "cancelled",
  "failed",
  "disconnected",
])("Auto Build resumes unfinished %s sessions in the same attempt", async (status) => {
  const { ctx, storage, task, started, followups } = await stoppedAttempt(status);
  const candidates = await autoBuildCandidatesCommand.run(ctx, {});
  expect(candidates.capacity).toEqual({ running: 0, limit: 6 });
  expect(candidates.candidates).toMatchObject([{ id: task.id, action: "resume" }]);
  expect(await autoBuildDispatchCommand.run(ctx, { ticket: task.id, revision: "test" })).toMatchObject({
    decision: "started",
    workspaceId: started.workspace.id,
    sessionId: started.session.id,
  });
  expect(followups).toEqual([started.session.id]);
  expect(await listAttempts(storage)).toHaveLength(1);
  expect((await autoBuildCandidatesCommand.run(ctx, {})).candidates).toEqual([]);
});

test("open human input keeps a cancelled implementation paused", async () => {
  const { ctx, task, started, followups } = await stoppedAttempt("cancelled");
  await requestHumanCommand.run(ctx, {
    ticket: task.id,
    workspaceId: started.workspace.id,
    sessionId: started.session.id,
    title: "Choose scope",
    instructions: "Confirm before continuing",
    request: { kind: "task" },
  });
  expect((await autoBuildCandidatesCommand.run(ctx, {})).candidates).toEqual([]);
  expect(await autoBuildDispatchCommand.run(ctx, { ticket: task.id, revision: "test" })).toMatchObject({
    decision: "wait",
  });
  expect(followups).toEqual([]);
});

test("resumption uses the selected attempt instead of an older stopped attempt", async () => {
  const { ctx, storage, task, started, followups } = await stoppedAttempt("cancelled");
  const selected = {
    ...started.variant,
    workspaceId: "selected-workspace",
    implementationSessionId: "selected-session",
  };
  await putAttempt(storage, selected);
  await attemptSelectionsCollection(storage).put(task.id, {
    ticketId: task.id,
    workspaceId: selected.workspaceId,
    selectedBy: { type: "human", id: "user", displayName: "User" },
    humanRequestId: null,
    selectedAt: new Date().toISOString(),
  });
  expect(await autoBuildDispatchCommand.run(ctx, { ticket: task.id, revision: "test" })).toMatchObject({
    decision: "started",
    workspaceId: selected.workspaceId,
    sessionId: selected.implementationSessionId,
  });
  expect(followups).toEqual([selected.implementationSessionId]);
});

test("a selected attempt in review does not restart an older implementation", async () => {
  const { ctx, storage, task, started, followups } = await stoppedAttempt("completed");
  const selected = {
    ...started.variant,
    workspaceId: "selected-workspace",
    revisions: [
      {
        revision: 1,
        baseSha: "main-sha",
        headSha: "submitted-head",
        changeRequestReportId: "report",
        submittedAt: new Date().toISOString(),
        submittedBy: { type: "agent" as const, id: "owner", displayName: "Owner" },
        reviews: [],
      },
    ],
  };
  await putAttempt(storage, selected);
  await attemptSelectionsCollection(storage).put(task.id, {
    ticketId: task.id,
    workspaceId: selected.workspaceId,
    selectedBy: { type: "human", id: "user", displayName: "User" },
    humanRequestId: null,
    selectedAt: new Date().toISOString(),
  });
  expect((await autoBuildCandidatesCommand.run(ctx, {})).candidates).toEqual([]);
  expect(followups).toEqual([]);
});

test("resuming a stopped attempt still waits for its dependency revision", async () => {
  const { ctx, storage, task, ticket, followups } = await stoppedAttempt("cancelled");
  const parent = await ticket("Prerequisite revision");
  await putTicket(storage, { ...task, dependsOn: [parent.id] });
  expect((await autoBuildCandidatesCommand.run(ctx, {})).candidates.some(({ id }) => id === task.id)).toBe(false);
  expect(await autoBuildDispatchCommand.run(ctx, { ticket: task.id, revision: "test" })).toMatchObject({
    decision: "wait",
  });
  expect(followups).toEqual([]);
});

test("an explicit user stop stays stopped", async () => {
  const { ctx, task, followups } = await stoppedAttempt("cancelled");
  const get = ctx.sessions.get;
  ctx.sessions.get = async (id) =>
    ({ ...(await get(id)), last_exit: { cause: "user_stop", startedAt: null, endedAt: null } }) as never;
  expect((await autoBuildCandidatesCommand.run(ctx, {})).candidates).toEqual([]);
  expect(await autoBuildDispatchCommand.run(ctx, { ticket: task.id, revision: "test" })).toMatchObject({
    decision: "wait",
  });
  expect(followups).toEqual([]);
});

test.each(["missing metadata", "deleted folder"])("an explicit user stop stays stopped with %s", async (missing) => {
  const { ctx, task, started, followups } = await stoppedAttempt("cancelled");
  const get = ctx.sessions.get;
  ctx.sessions.get = async (id) =>
    ({ ...(await get(id)), last_exit: { cause: "user_stop", startedAt: null, endedAt: null } }) as never;
  if (missing === "missing metadata") ctx.workspaces.get = async () => null;
  else {
    const run = ctx.process.run;
    ctx.process.run = async (input) =>
      input.command.includes(`/workspace/${started.workspace.id}`)
        ? { exitCode: 128, stdout: "", stderr: "Workspace folder missing" }
        : run(input);
  }
  expect((await autoBuildCandidatesCommand.run(ctx, {})).candidates).toEqual([]);
  expect(await autoBuildDispatchCommand.run(ctx, { ticket: task.id, revision: "test" })).toMatchObject({
    decision: "wait",
  });
  expect(followups).toEqual([]);
});

test.each([
  "blocked status",
  "blocked reason",
])("unfinished work waits for its %s without answered input", async (blocker) => {
  const { ctx, storage, task, followups } = await stoppedAttempt("completed");
  await putTicket(storage, {
    ...task,
    ...(blocker === "blocked status"
      ? { statusId: "blocked" }
      : { blockedReason: "Wait until the customer supplies access." }),
  });
  expect((await autoBuildCandidatesCommand.run(ctx, {})).candidates).toEqual([]);
  expect(await autoBuildDispatchCommand.run(ctx, { ticket: task.id, revision: "test" })).toMatchObject({
    decision: "wait",
  });
  expect(followups).toEqual([]);
});

test("a stopped turn is resumed once while a later stopped turn can resume again", async () => {
  const { ctx, task, started } = await stoppedAttempt("cancelled");
  await autoBuildDispatchCommand.run(ctx, { ticket: task.id, revision: "test" });
  ctx.sessions.get = async (id) =>
    ({
      type: "session",
      id,
      title: "Implementation",
      status: "cancelled",
      updated_at: "2026-10-12T19:00:00.000Z",
    }) as never;
  expect((await autoBuildCandidatesCommand.run(ctx, {})).candidates).toEqual([]);
  ctx.sessions.get = async (id) =>
    ({
      type: "session",
      id,
      title: "Implementation",
      status: "cancelled",
      updated_at: "2026-10-12T20:00:00.000Z",
    }) as never;
  expect((await autoBuildCandidatesCommand.run(ctx, {})).candidates).toMatchObject([{ id: task.id, action: "resume" }]);
  expect(await autoBuildDispatchCommand.run(ctx, { ticket: task.id, revision: "test" })).toMatchObject({
    decision: "started",
    sessionId: started.session.id,
  });
});

test("multiple stopped attempts wait for an explicit selection", async () => {
  const { ctx, storage, started } = await stoppedAttempt("cancelled");
  await putAttempt(storage, { ...started.variant, workspaceId: "other-workspace" });
  expect((await autoBuildCandidatesCommand.run(ctx, {})).candidates).toEqual([]);
});
