import { expect, test } from "bun:test";
import { fixture } from "../commands/auto-build.fixture";
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
