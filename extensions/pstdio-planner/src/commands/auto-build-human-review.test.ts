import { expect, test } from "bun:test";
import { listAttempts, putAttempt } from "../data/attempt-storage";
import { putTicket } from "../data/ticket-context.fixture";

import { fixture } from "./auto-build.fixture";
import { autoBuildCandidatesCommand } from "./auto-build-candidates";
import { autoBuildDispatchCommand } from "./auto-build-dispatch";
import { configureAutoBuildCommand, readAutoBuildCommand } from "./auto-build-mode";
import { requestHumanCommand, reviewCommand } from "./review-requests";
import { runAttemptCommand } from "./run-attempt";
import { sessionQuery } from "./session-query.fixture";
import { sessionRecord } from "./session-record.fixture";

test.each([
  "completed",
  "awaiting_input",
])("a paused implementation with open human input is reported as stuck (%s)", async (status) => {
  const { ctx, ticket } = await fixture();
  const task = await ticket("Waiting for a human");
  const attempt = await runAttemptCommand.run(ctx, { ticket: task.id });
  ctx.sessions.get = async (id) => ({ type: "session", id, title: "Implementation", status }) as never;
  ctx.sessions.query = sessionQuery(async () =>
    status === "awaiting_input"
      ? [{ id: attempt.session.id, title: "Implementation", status, anchors_json: [{ type: "ticket", id: task.id }] }]
      : [],
  );
  await requestHumanCommand.run(ctx, {
    ticket: task.id,
    workspaceId: attempt.workspace.id,
    sessionId: attempt.session.id,
    title: "Confirm",
    instructions: "Choose scope",
    request: { kind: "task" },
  });
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ stuck: true });
});

async function dispatchCandidates(ctx: Awaited<ReturnType<typeof fixture>>["ctx"]) {
  const result = await autoBuildCandidatesCommand.run(ctx, {});
  const started: { ticket: string; workspaceId: string; sessionId: string }[] = [];
  for (const candidate of result.candidates) {
    const dispatch = await autoBuildDispatchCommand.run(ctx, { ticket: candidate.id, revision: result.revision });
    if (dispatch.decision === "started")
      started.push({ ticket: candidate.ticket, workspaceId: dispatch.workspaceId, sessionId: dispatch.sessionId });
  }
  return { started };
}

test.each([
  true,
  false,
])("answered implementation input still waits for unanswered prerequisite input (block on review: %s)", async (blockOnReview) => {
  const { ctx, storage, ticket } = await fixture();
  const parent = await ticket("Prerequisite");
  const mode = await configureAutoBuildCommand.run(ctx, { enabled: true, blockOnReview });
  await putTicket(storage, { ...parent, statusId: "done" });
  const child = await ticket("Dependent", [parent.id]);
  const first = (await dispatchCandidates(ctx)).started[0]!;
  ctx.sessions.get = async (id) => sessionRecord({ id, title: "Implementation", status: "completed" });
  const ownRequest = await requestHumanCommand.run(ctx, {
    ticket: child.id,
    workspaceId: first.workspaceId,
    sessionId: first.sessionId,
    title: "Confirm",
    instructions: "Continue the work",
    request: { kind: "task" },
  });
  await reviewCommand.run(ctx, { requestId: ownRequest.id, response: { confirmed: true } });
  await putTicket(storage, { ...parent, statusId: "ready" });
  await requestHumanCommand.run(ctx, {
    ticket: parent.id,
    title: "Check prerequisite",
    instructions: "Confirm its scope",
    request: { kind: "task" },
  });
  expect((await autoBuildCandidatesCommand.run(ctx, {})).candidates.some(({ id }) => id === child.id)).toBe(false);
  expect(await autoBuildDispatchCommand.run(ctx, { ticket: child.id, revision: mode.revision })).toMatchObject({
    decision: "wait",
  });
});

test("resolved human input resumes the same implementation when capacity becomes available", async () => {
  const { ctx, ticket } = await fixture(1);
  const task = await ticket("Continue after human input");
  const first = (await dispatchCandidates(ctx)).started[0]!;
  let status = "completed";
  const followups: { sessionId: string; prompt?: string }[] = [];
  ctx.sessions.get = async () => ({ type: "session", id: first.sessionId, title: "Implementation", status }) as never;
  ctx.sessions.followup = async (input) => {
    followups.push(input);
    status = "in_progress";
    return {} as never;
  };
  const request = await requestHumanCommand.run(ctx, {
    ticket: task.id,
    workspaceId: first.workspaceId,
    sessionId: first.sessionId,
    title: "Confirm the workspace is ready",
    instructions: "Restore the process target, then continue the implementation.",
    request: { kind: "task" },
  });
  expect((await dispatchCandidates(ctx)).started).toHaveLength(0);
  await reviewCommand.run(ctx, { requestId: request.id, response: { confirmed: true } });
  await ctx.settings.set("automation.maxInProgress", 0);
  expect((await dispatchCandidates(ctx)).started).toHaveLength(0);
  expect(followups).toHaveLength(0);
  await ctx.settings.set("automation.maxInProgress", 1);
  expect((await dispatchCandidates(ctx)).started).toEqual([first]);
  expect(followups).toHaveLength(1);
  expect(followups[0]!.sessionId).toBe(first.sessionId);
  expect(followups[0]!.prompt).toContain("Completion confirmed");
  expect(await listAttempts(ctx.storage)).toHaveLength(1);
  status = "completed";
  expect((await dispatchCandidates(ctx)).started).toHaveLength(0);
  expect(followups).toHaveLength(1);
});

test("a resolved implementation waits until another running ticket frees a slot", async () => {
  const { ctx, ticket } = await fixture(1);
  const task = await ticket("Resume after a running ticket");
  const first = (await dispatchCandidates(ctx)).started[0]!;
  let occupied = true;
  ctx.sessions.get = async (id) =>
    ({
      type: "session",
      id,
      title: "Implementation",
      status: id !== first.sessionId && occupied ? "in_progress" : "completed",
    }) as never;
  const request = await requestHumanCommand.run(ctx, {
    ticket: task.id,
    workspaceId: first.workspaceId,
    sessionId: first.sessionId,
    title: "Confirm",
    instructions: "Continue after confirmation",
    request: { kind: "task" },
  });
  await reviewCommand.run(ctx, { requestId: request.id, response: { confirmed: true } });
  const other = await ticket("Running ticket");
  const otherAttempt = await runAttemptCommand.run(ctx, { ticket: other.id });
  const followups: string[] = [];
  ctx.sessions.followup = async ({ sessionId }) => {
    followups.push(sessionId);
    return {} as never;
  };
  const full = await dispatchCandidates(ctx);
  expect(full.started).toHaveLength(0);
  expect(await autoBuildDispatchCommand.run(ctx, { ticket: task.id, revision: "test" })).toMatchObject({
    reason: "capacity-full",
  });
  occupied = false;
  // The other owner has handed in its work, so only the answered implementation resumes.
  await putAttempt(ctx.storage, {
    ...otherAttempt.variant,
    revisions: [
      {
        revision: 1,
        baseSha: "main-sha",
        headSha: "other-head",
        changeRequestReportId: "other-report",
        submittedAt: new Date().toISOString(),
        submittedBy: { type: "agent", id: "owner", displayName: "Owner" },
        reviews: [],
      },
    ],
  });
  expect((await dispatchCandidates(ctx)).started).toEqual([first]);
  expect(followups).toContain(first.sessionId);
  expect(await listAttempts(ctx.storage)).toHaveLength(2);
});

test("resolved input waits until every open request is answered", async () => {
  const { ctx, ticket } = await fixture(1);
  const task = await ticket("Paused task");
  const first = (await dispatchCandidates(ctx)).started[0]!;
  ctx.sessions.get = async () =>
    ({ type: "session", id: first.sessionId, title: "Implementation", status: "completed" }) as never;
  const followups: string[] = [];
  ctx.sessions.followup = async ({ sessionId }) => {
    followups.push(sessionId);
    return {} as never;
  };
  const requests = [];
  for (const title of ["First question", "Second question"]) {
    requests.push(
      await requestHumanCommand.run(ctx, {
        ticket: task.id,
        workspaceId: first.workspaceId,
        sessionId: first.sessionId,
        title,
        instructions: "Confirm before continuing",
        request: { kind: "task" },
      }),
    );
  }
  await reviewCommand.run(ctx, { requestId: requests[0]!.id, response: { confirmed: true } });
  expect((await dispatchCandidates(ctx)).started).toHaveLength(0);
  await reviewCommand.run(ctx, { requestId: requests[1]!.id, response: { confirmed: true } });
  expect((await dispatchCandidates(ctx)).started).toEqual([first]);
  expect(followups).toEqual([first.sessionId]);
});

test("resolved implementation input continues an assigned owner in a blocked column", async () => {
  const { ctx, storage, ticket } = await fixture();
  const task = await ticket("Blocked waiting for input");
  const owner = await runAttemptCommand.run(ctx, { ticket: task.id });
  ctx.sessions.get = async (id) => ({ id, title: id, status: "completed" }) as never;
  const request = await requestHumanCommand.run(ctx, {
    ticket: task.id,
    workspaceId: owner.workspace.id,
    sessionId: owner.session.id,
    title: "Choose scope",
    instructions: "Continue after decision",
    request: { kind: "task" },
  });
  await putTicket(storage, { ...task, statusId: "blocked", blockedReason: "Waiting for input" });
  await reviewCommand.run(ctx, { requestId: request.id, response: { confirmed: true } });
  const followups: string[] = [];
  ctx.sessions.followup = async ({ sessionId }) => {
    followups.push(sessionId);
  };
  expect((await autoBuildCandidatesCommand.run(ctx, {})).candidates).toMatchObject([{ action: "resume", id: task.id }]);
  await autoBuildDispatchCommand.run(ctx, { ticket: task.id, revision: "test" });
  expect(followups).toEqual([owner.session.id]);
  expect((await storage.collection<{ statusId: string }>("tickets").get(task.id))?.statusId).toBe("blocked");
});
