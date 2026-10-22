import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { ticketsCollection } from "../data/collections";
import { runTicketsQuery } from "../data/query";
import {
  listTicketReviewRequests,
  reviewOutcomesCollection,
  reviewRequestsCollection,
} from "../data/review-request-storage";
import { readPlanCommand } from "../timeline/commands/read-plan";
import { loadAttemptReadiness } from "./attempt-readiness";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { requestHumanCommand } from "./review-requests";
import { setTicketTagsCommand } from "./ticket-tags";
import { updateTicketCommand } from "./update-ticket";

const setup = async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: {
      sessions: {
        create: async () => ({ type: "session", id: "chat", title: "Chat", status: "in_progress" }),
        get: async () => ({ type: "session", id: "chat", title: "Chat", status: "in_progress" }),
      } as never,
    },
  });
  const ticket = await createTicketCommand.run(ctx, { title: "Build a tool", statusId: "ready" });
  return { storage, ctx, ticket };
};

test("unreadable requests block launch and dependent work without a flag", async () => {
  const { storage, ctx, ticket } = await setup();
  await reviewRequestsCollection(storage).put("broken", { id: "broken", ticketId: ticket.id } as never);
  const dependent = await createTicketCommand.run(ctx, { title: "Use the tool", dependsOn: [ticket.id] });
  for (const target of [ticket, dependent]) {
    expect((await loadAttemptReadiness(ctx, target.id, {})).readiness).toMatchObject({
      decision: "wait",
      reason: "human-input-needed",
      dependencyIds: [ticket.shorthand],
    });
  }
  expect(
    (await runTicketsQuery({ storage, projectId: ctx.projectId })).rows.find(({ id }) => id === ticket.id)?.attributes
      ?.reviewRequestItems,
  ).toEqual([expect.objectContaining({ label: "1", color: "orange" })]);
});

test("ticket tag edits preserve pending input and request history", async () => {
  const { storage, ctx, ticket } = await setup();
  const request = await requestHumanCommand.run(ctx, {
    ticket: ticket.id,
    title: "Choose the scope",
    instructions: "Confirm the tool scope.",
    request: { kind: "task" },
  } as never);
  await updateTicketCommand.run(ctx, { id: ticket.id, tagIds: [] });
  await setTicketTagsCommand.run(ctx, { rowId: ticket.id, tagIds: [] });
  expect((await loadAttemptReadiness(ctx, ticket.id, {})).readiness).toMatchObject({
    decision: "wait",
    reason: "human-input-needed",
  });
  expect(await reviewRequestsCollection(storage).get(request.id)).toMatchObject({ id: request.id });
});

test("an open request blocks the ticket and prerequisites without a stored tag", async () => {
  const { storage, ctx, ticket } = await setup();
  await requestHumanCommand.run(ctx, {
    ticket: ticket.id,
    title: "Check the preview",
    instructions: "Confirm the layout.",
    request: { kind: "task" },
  } as never);
  await ticketsCollection(storage).put(ticket.id, { ...ticket, tagIds: [] });
  const dependent = await createTicketCommand.run(ctx, { title: "Use the tool", dependsOn: [ticket.id] });
  for (const target of [ticket, dependent]) {
    expect((await loadAttemptReadiness(ctx, target.id, {})).readiness).toMatchObject({
      decision: "wait",
      reason: "human-input-needed",
      dependencyIds: [ticket.shorthand],
    });
  }
  const plan = await readPlanCommand.run(ctx, {});
  expect(plan.sections.flatMap(({ rows }) => rows).find(({ id }) => id === ticket.id)).toMatchObject({
    state: "await-input",
    requests: [expect.objectContaining({ state: "open" })],
  });
});

test("an unreadable outcome keeps a concrete error and pending input", async () => {
  const { storage, ctx, ticket } = await setup();
  const request = await requestHumanCommand.run(ctx, {
    ticket: ticket.id,
    title: "Check the preview",
    instructions: "Confirm the layout.",
    request: { kind: "task" },
  } as never);
  await reviewOutcomesCollection(storage).put(request.id, {
    requestId: request.id,
    kind: "answered",
    response: { confirmed: false },
  } as never);
  await ticketsCollection(storage).put(ticket.id, { ...ticket, tagIds: [] });
  const group = await listTicketReviewRequests(storage, ticket.id);
  expect(group.errors).toHaveLength(1);
  expect(group.errors[0]).toContain(request.id);
  expect((await loadAttemptReadiness(ctx, ticket.id, {})).readiness).toMatchObject({
    decision: "wait",
    reason: "human-input-needed",
  });
  const plan = await readPlanCommand.run(ctx, {});
  expect(plan.sections.flatMap(({ rows }) => rows).find(({ id }) => id === ticket.id)).toMatchObject({
    state: "await-input",
    requestErrors: group.errors,
  });
});

test.each(["open", "unreadable"])("%s input on completed ancestors blocks dependent launch", async (state) => {
  const { storage, ctx, ticket } = await setup();
  if (state === "open") {
    await requestHumanCommand.run(ctx, {
      ticket: ticket.id,
      title: "Check the preview",
      instructions: "Confirm the layout.",
      request: { kind: "task" },
    } as never);
  } else {
    await reviewRequestsCollection(storage).put("broken", { id: "broken", ticketId: ticket.id } as never);
  }
  await updateTicketCommand.run(ctx, { id: ticket.id, statusId: "done" });
  const intermediate = await createTicketCommand.run(ctx, {
    title: "Completed integration",
    dependsOn: [ticket.id],
    statusId: "done",
  });
  const dependent = await createTicketCommand.run(ctx, { title: "Use the tool", dependsOn: [intermediate.id] });
  for (const target of [intermediate, dependent]) {
    expect((await loadAttemptReadiness(ctx, target.id, {})).readiness).toMatchObject({
      decision: "wait",
      reason: "human-input-needed",
      dependencyIds: [ticket.shorthand],
    });
  }
});
