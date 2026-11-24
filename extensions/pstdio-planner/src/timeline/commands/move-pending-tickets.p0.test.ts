import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandContext } from "../../commands/command-context.fixture";
import { createTicketCommand } from "../../commands/create-ticket";
import { moveTicketOnBoard } from "../../commands/move-ticket-on-board";
import { ticketRecordId } from "../../data/ticket-record-address";
import { createTicketCommand as createTimelineTicket } from "./create-ticket";
import { moveTicketInPlan } from "./move-ticket";
import { readPlanCommand } from "./read-plan";

test("moving one ticket leaves unrelated ticket bodies unloaded", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const moved = await createTicketCommand.run(ctx, { title: "Moved" });
  const unrelated = await createTicketCommand.run(ctx, { title: "Unrelated" });
  const unrelatedRecord = ticketRecordId(storage, unrelated.id);
  const observedReads: string[] = [];
  const read = storage.records.read.bind(storage.records);
  const readMany = storage.records.readMany.bind(storage.records);
  storage.records.read = async (id) => {
    observedReads.push(id);
    return read(id);
  };
  storage.records.readMany = async (ids) => {
    observedReads.push(...ids);
    return readMany(ids);
  };

  await moveTicketInPlan(ctx, { ticket: moved.id });

  expect(observedReads).not.toContain(unrelatedRecord);
});

test("moving a newly created ticket last works before opening Timeline", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const first = await createTicketCommand.run(ctx, { title: "First" });
  const second = await createTicketCommand.run(ctx, { title: "Second" });
  const third = await createTicketCommand.run(ctx, { title: "Third" });

  await moveTicketInPlan(ctx, { ticket: first.id });
  const plan = await readPlanCommand.run(ctx, {});

  expect(plan.sections.flatMap(({ rows }) => rows.map(({ id }) => id))).toEqual([second.id, third.id, first.id]);
});

test("moving before an unplaced ticket preserves its immediate neighbor", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const first = await createTicketCommand.run(ctx, { title: "First" });
  const second = await createTicketCommand.run(ctx, { title: "Second" });
  const third = await createTicketCommand.run(ctx, { title: "Third" });

  await moveTicketInPlan(ctx, { ticket: first.id, before: third.id });
  const plan = await readPlanCommand.run(ctx, {});

  expect(plan.sections.flatMap(({ rows }) => rows.map(({ id }) => id))).toEqual([second.id, first.id, third.id]);
});

test("creating a Timeline ticket follows pending ordinary tickets", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const first = await createTicketCommand.run(ctx, { title: "First" });
  const second = await createTicketCommand.run(ctx, { title: "Second" });

  const created = await createTimelineTicket.run(ctx, { content: "# Third" });
  const plan = await readPlanCommand.run(ctx, {});

  expect(plan.sections.flatMap(({ rows }) => rows.map(({ id }) => id))).toEqual([
    first.id,
    second.id,
    created.ticket.id,
  ]);
});

test("moving a board ticket out of a milestone follows pending tickets", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const first = await createTicketCommand.run(ctx, { title: "First" });
  await storage.set("timeline.plan", {
    deadlines: [{ id: "release", date: "2030-01-01" }],
    order: [{ ticketId: first.id, deadlineId: "release" }],
  });
  const second = await createTicketCommand.run(ctx, { title: "Second" });
  const third = await createTicketCommand.run(ctx, { title: "Third" });

  await moveTicketOnBoard(ctx, { rowId: first.id, attributes: { milestone: "none" } });
  const plan = await readPlanCommand.run(ctx, {});

  expect(plan.sections.flatMap(({ rows }) => rows.map(({ id }) => id))).toEqual([second.id, third.id, first.id]);
});
