import { expect, test } from "bun:test";
import { fixture } from "../commands/auto-build.fixture";
import { requestHumanCommand } from "../commands/review-requests";
import { runAttemptCommand } from "../commands/run-attempt";
import { plannerTicketsChanged } from "../events";
import { rollUpAttemptTicket } from "./attempt-rollup";
import { putAttempt } from "./attempt-storage";
import { ticketsCollection } from "./collections";

test("completion publishes In Review before notifying the timeline", async () => {
  const { ctx, ticket } = await fixture();
  const task = await ticket("Completed implementation");
  const { attempt } = await runAttemptCommand.run(ctx, { ticket: task.id });
  await putAttempt(ctx.storage, { ...attempt, state: "review_ready" });
  const notifications: unknown[] = [];
  ctx.events.emit = async (event, payload) => {
    notifications.push({ event, payload, status: (await ticketsCollection(ctx.storage).get(task.id))?.statusId });
    return { delivered: 1 };
  };
  await rollUpAttemptTicket(ctx, task.id);
  expect(notifications).toEqual([
    { event: plannerTicketsChanged, payload: { ticketId: task.id }, status: "in-review" },
  ]);
});

test.each([
  "completed",
  "cancelled",
  "failed",
  "disconnected",
])("unfinished work returns to Todo when its implementation session is %s", async (status) => {
  const { ctx, ticket } = await fixture();
  const task = await ticket("Unfinished implementation");
  await runAttemptCommand.run(ctx, { ticket: task.id });
  ctx.sessions.get = async (id) => ({ id, status }) as never;
  expect((await rollUpAttemptTicket(ctx, task.id)).statusId).toBe("ready");
});

test("a stopped implementation with an open human request is Blocked", async () => {
  const { ctx, ticket } = await fixture();
  const task = await ticket("Waiting for dependency code");
  const { attempt } = await runAttemptCommand.run(ctx, { ticket: task.id });
  await requestHumanCommand.run(ctx, {
    ticket: task.id,
    workspaceId: attempt.workspaceId,
    sessionId: attempt.implementationSessionId,
    title: "Provide dependency code",
    instructions: "Integrate the prerequisite revisions before continuing.",
    request: { kind: "task" },
  });
  ctx.sessions.get = async (id) => ({ id, status: "completed" }) as never;
  expect((await rollUpAttemptTicket(ctx, task.id)).statusId).toBe("blocked");
});

test("a resumed implementation returns to In Progress", async () => {
  const { ctx, ticket } = await fixture();
  const task = await ticket("Resume implementation");
  await runAttemptCommand.run(ctx, { ticket: task.id });
  ctx.sessions.get = async (id) => ({ id, status: "completed" }) as never;
  await rollUpAttemptTicket(ctx, task.id);
  ctx.sessions.get = async (id) => ({ id, status: "in_progress" }) as never;
  expect((await rollUpAttemptTicket(ctx, task.id)).statusId).toBe("in-progress");
});

test("a session that stops before its attempt is saved leaves the ticket Todo", async () => {
  const { ctx, ticket } = await fixture();
  const task = await ticket("Short implementation");
  ctx.sessions.get = async (id) => ({ id, status: "completed" }) as never;
  await runAttemptCommand.run(ctx, { ticket: task.id });
  expect((await ticketsCollection(ctx.storage).get(task.id))?.statusId).toBe("ready");
});
