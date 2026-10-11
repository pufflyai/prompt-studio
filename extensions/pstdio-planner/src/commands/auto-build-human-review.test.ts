import { expect, test } from "bun:test";
import { listAttempts } from "../data/attempt-storage";
import { autoBuildCommand } from "./auto-build";
import { fixture } from "./auto-build.fixture";
import { configureAutoBuildCommand } from "./auto-build-mode";
import { requestHumanCommand, reviewCommand } from "./review-requests";
import { runAttemptCommand } from "./run-attempt";

test("resolved human input resumes the same implementation when capacity becomes available", async () => {
  const { ctx, ticket } = await fixture(1);
  const task = await ticket("Continue after human input");
  const first = (await autoBuildCommand.run(ctx, {})).started[0]!;
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
  expect((await autoBuildCommand.run(ctx, {})).started).toHaveLength(0);
  await reviewCommand.run(ctx, { requestId: request.id, response: { confirmed: true } });
  await ctx.settings.set("automation.maxInProgress", 0);
  expect((await autoBuildCommand.run(ctx, {})).started).toHaveLength(0);
  expect(followups).toHaveLength(0);
  await ctx.settings.set("automation.maxInProgress", 1);
  expect((await autoBuildCommand.run(ctx, {})).started).toEqual([first]);
  expect(followups).toHaveLength(1);
  expect(followups[0]!.sessionId).toBe(first.sessionId);
  expect(followups[0]!.prompt).toContain("Completion confirmed");
  expect(await listAttempts(ctx.storage)).toHaveLength(1);
  status = "completed";
  expect((await autoBuildCommand.run(ctx, {})).started).toHaveLength(0);
  expect(followups).toHaveLength(1);
});

test("a resolved implementation waits until another running ticket frees a slot", async () => {
  const { ctx, ticket } = await fixture(1);
  const task = await ticket("Resume after a running ticket");
  const first = (await autoBuildCommand.run(ctx, {})).started[0]!;
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
  const full = await autoBuildCommand.run(ctx, {});
  expect(full.started).toHaveLength(0);
  expect(full.skipped).toContainEqual({ ticket: task.shorthand, reason: "capacity-full" });
  occupied = false;
  expect((await autoBuildCommand.run(ctx, {})).started).toEqual([first]);
  expect(followups).toEqual([first.sessionId]);
  expect(await listAttempts(ctx.storage)).toHaveLength(2);
});

test("resolved input waits for all requests and still respects the saved filters", async () => {
  const { ctx, ticket } = await fixture(1);
  const task = await ticket("Paused task");
  const first = (await autoBuildCommand.run(ctx, {})).started[0]!;
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
  expect((await autoBuildCommand.run(ctx, {})).started).toHaveLength(0);
  await reviewCommand.run(ctx, { requestId: requests[1]!.id, response: { confirmed: true } });
  await configureAutoBuildCommand.run(ctx, {
    enabled: true,
    filter: { conjunction: "and", rules: [{ attributeId: "title", condition: "contains", value: "Other" }] },
  });
  expect((await autoBuildCommand.run(ctx, {})).started).toHaveLength(0);
  expect(followups).toHaveLength(0);
  await configureAutoBuildCommand.run(ctx, { enabled: true, filter: { conjunction: "and", rules: [] } });
  expect((await autoBuildCommand.run(ctx, {})).started).toEqual([first]);
  expect(followups).toEqual([first.sessionId]);
});
