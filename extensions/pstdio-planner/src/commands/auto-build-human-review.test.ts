import { expect, test } from "bun:test";
import { listAttempts } from "../data/attempt-storage";
import { fixture } from "./auto-build.fixture";
import { autoBuildCandidatesCommand } from "./auto-build-candidates";
import { autoBuildDispatchCommand } from "./auto-build-dispatch";
import { requestHumanCommand, reviewCommand } from "./review-requests";
import { runAttemptCommand } from "./run-attempt";

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
  await runAttemptCommand.run(ctx, { ticket: other.id });
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
  expect((await dispatchCandidates(ctx)).started).toEqual([first]);
  expect(followups).toEqual([first.sessionId]);
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
