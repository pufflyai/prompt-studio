import { expect, test } from "bun:test";
import { sessionEvents } from "@pstdio/sdk/extensions";
import { fixture } from "../commands/auto-build.fixture";
import { requestHumanCommand, reviewCommand } from "../commands/review-requests";
import { runAttemptCommand } from "../commands/run-attempt";
import { saveAutoBuildSupervisor } from "../data/auto-build-supervisor";
import { ticketsCollection } from "../data/collections";
import {
  attemptStatusProjectOpenedHook,
  attemptStatusSessionHooks,
  attemptStatusTicketsChangedHook,
} from "./attempt-status";

test.each(
  attemptStatusSessionHooks.map((hook) => [hook.event.id, hook] as const),
)("supervisor lifecycle %s does not scan ticket attempts", async (_id, hook) => {
  const { ctx } = await fixture();
  await saveAutoBuildSupervisor(ctx, { sessionId: "supervisor" });
  ctx.storage.collection = () => {
    throw new Error("Supervisor lifecycle must not read ticket collections");
  };
  await hook.run(
    { ...ctx, eventId: hook.event.id, deliveryId: "supervisor" },
    {
      sessionId: "supervisor",
      projectId: ctx.projectId,
      sessionStatus: "completed",
    },
  );
});

test("session completion updates an unfinished ticket even with Auto Build off", async () => {
  const { ctx, ticket } = await fixture();
  await ctx.storage.set("auto-build", { enabled: false });
  const task = await ticket("Stopped work");
  const other = await ticket("Other active work");
  const { attempt } = await runAttemptCommand.run(ctx, { ticket: task.id });
  const { attempt: active } = await runAttemptCommand.run(ctx, { ticket: other.id });
  ctx.sessions.get = async (id) =>
    ({ id, status: id === active.implementationSessionId ? "in_progress" : "completed" }) as never;
  const hook = attemptStatusSessionHooks.find(({ event }) => event.id === sessionEvents.completed.id)!;
  await hook.run(
    { ...ctx, eventId: hook.event.id, deliveryId: "completed" },
    {
      sessionId: attempt.implementationSessionId,
      projectId: ctx.projectId,
      sessionStatus: "completed",
    },
  );
  expect((await ticketsCollection(ctx.storage).get(task.id))?.statusId).toBe("ready");
  expect((await ticketsCollection(ctx.storage).get(other.id))?.statusId).toBe("in-progress");
});

test("opening the project repairs stale status without starting agents", async () => {
  const { ctx, ticket } = await fixture();
  const task = await ticket("Stale work");
  await runAttemptCommand.run(ctx, { ticket: task.id });
  ctx.sessions.get = async (id) => ({ id, status: "cancelled" }) as never;
  ctx.sessions.followup = async () => {
    throw new Error("Must not start agents");
  };
  const hook = attemptStatusProjectOpenedHook;
  await hook.run({ ...ctx, eventId: hook.event.id, deliveryId: "opened" }, { projectId: ctx.projectId });
  expect((await ticketsCollection(ctx.storage).get(task.id))?.statusId).toBe("ready");
});

test("removed tickets do not prevent other managed statuses from refreshing", async () => {
  const { ctx, ticket } = await fixture();
  const removed = await ticket("Removed work");
  await runAttemptCommand.run(ctx, { ticket: removed.id });
  await ticketsCollection(ctx.storage).delete(removed.id);
  const task = await ticket("Remaining work");
  await runAttemptCommand.run(ctx, { ticket: task.id });
  ctx.sessions.get = async (id) => ({ id, status: "completed" }) as never;
  const hook = attemptStatusProjectOpenedHook;
  await hook.run({ ...ctx, eventId: hook.event.id, deliveryId: "opened" }, { projectId: ctx.projectId });
  expect((await ticketsCollection(ctx.storage).get(task.id))?.statusId).toBe("ready");
});

test("answering human input makes stopped work Todo and resuming makes it In Progress", async () => {
  const { ctx, ticket } = await fixture();
  const task = await ticket("Needs input");
  const { attempt } = await runAttemptCommand.run(ctx, { ticket: task.id });
  const request = await requestHumanCommand.run(ctx, {
    ticket: task.id,
    workspaceId: attempt.workspaceId,
    sessionId: attempt.implementationSessionId,
    title: "Choose scope",
    instructions: "Confirm the scope",
    request: { kind: "task" },
  });
  ctx.sessions.get = async (id) => ({ id, status: "completed" }) as never;
  const changed = attemptStatusTicketsChangedHook;
  const refresh = () =>
    changed.run({ ...ctx, eventId: changed.event.id, deliveryId: "changed" }, { ticketId: task.id });
  await refresh();
  expect((await ticketsCollection(ctx.storage).get(task.id))?.statusId).toBe("blocked");
  await reviewCommand.run(ctx, { requestId: request.id, response: { confirmed: true } });
  await refresh();
  expect((await ticketsCollection(ctx.storage).get(task.id))?.statusId).toBe("ready");
  ctx.sessions.get = async (id) => ({ id, status: "in_progress" }) as never;
  const resumed = attemptStatusSessionHooks.find(({ event }) => event.id === sessionEvents.resumed.id)!;
  await resumed.run(
    { ...ctx, eventId: resumed.event.id, deliveryId: "resumed" },
    { sessionId: attempt.implementationSessionId, projectId: ctx.projectId, sessionStatus: "in_progress" },
  );
  expect((await ticketsCollection(ctx.storage).get(task.id))?.statusId).toBe("in-progress");
});
