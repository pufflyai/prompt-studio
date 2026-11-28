import { expect, test } from "bun:test";
import { ticketsCollection } from "../data/ticket-context.fixture";

import { withWriteGuard } from "../data/write-guard";
import { planPlacements } from "../timeline/commands/placement-store";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { moveTicketOnBoard } from "./move-ticket-on-board";
import { ticketMoveFixture } from "./ticket-move.fixture";

const preview = { id: "preview", date: "2026-10-15", name: "Preview" };
const milestoneOf = async (storage: Parameters<typeof planPlacements>[0], ticketId: string) =>
  (await planPlacements(storage).get(ticketId))?.deadlineId ?? null;

test("column, row group, and order save as one move and one completed event", async () => {
  const f = await ticketMoveFixture();
  const [first, hidden, last] = f.tickets;
  await moveTicketOnBoard(f.ctx, {
    rowId: last.id,
    attributes: { status: "done", priority: "default-priority-high" },
    order: { beforeRowId: first.id },
  });
  expect(await f.ordered()).toEqual([last.id, first.id, hidden.id]);
  expect(await ticketsCollection(f.storage).get(last.id)).toMatchObject({
    statusId: "done",
    tags: { "default-priority": "default-priority-high" },
  });
  expect(f.writes).toEqual([last.id]);
  expect(f.events).toEqual(["tickets.changed"]);
});

test("sorted moves preserve manual order and skip unchanged grouping values", async () => {
  const f = await ticketMoveFixture();
  const [first, hidden, last] = f.tickets;
  await moveTicketOnBoard(f.ctx, { rowId: first.id, attributes: { status: "done" } });
  expect(await f.ordered()).toEqual([first.id, hidden.id, last.id]);
  f.writes.length = 0;
  f.events.length = 0;
  await moveTicketOnBoard(f.ctx, { rowId: first.id, attributes: { status: "done" } });
  expect(f.writes).toEqual([]);
  expect(f.events).toEqual([]);
});

test("rapid moves of different tickets wait for the same order guard and both save", async () => {
  const f = await ticketMoveFixture();
  const [first, hidden, last] = f.tickets;
  await expect(
    Promise.all([
      moveTicketOnBoard(f.ctx, { rowId: first.id, attributes: { status: "ready" }, order: {} }),
      moveTicketOnBoard(f.ctx, {
        rowId: last.id,
        attributes: { status: "done" },
        order: { beforeRowId: hidden.id },
      }),
    ]),
  ).resolves.toEqual([{ changed: 1 }, { changed: 1 }]);
  expect(await ticketsCollection(f.storage).get(first.id)).toMatchObject({ statusId: "ready" });
  expect(await ticketsCollection(f.storage).get(last.id)).toMatchObject({ statusId: "done" });
  expect(await f.ordered()).toEqual([last.id, hidden.id, first.id]);
});

test("invalid tag cardinality fails before changing status or order", async () => {
  const f = await ticketMoveFixture();
  const [first, , last] = f.tickets;
  await expect(
    moveTicketOnBoard(f.ctx, {
      rowId: last.id,
      attributes: { status: "done", priority: ["default-priority-high", "default-priority-medium"] },
      order: { beforeRowId: first.id },
    }),
  ).rejects.toThrow("allows one value");
  expect(f.writes).toEqual([]);
  expect(f.events).toEqual([]);
});

test("archived cards retain attribute moves without joining active manual order", async () => {
  const f = await ticketMoveFixture();
  const [first, hidden] = f.tickets;
  await ticketsCollection(f.storage).put(first.id, { ...first, archived: true });
  await moveTicketOnBoard(f.ctx, {
    rowId: first.id,
    attributes: { status: "done" },
    order: { beforeRowId: hidden.id },
  });
  expect(await ticketsCollection(f.storage).get(first.id)).toMatchObject({
    archived: true,
    statusId: "done",
    position: first.position,
  });
  expect(f.writes).toEqual([first.id]);
  expect(f.events).toEqual(["tickets.changed"]);
});

test("creating a ticket during an append move cannot save the same position", async () => {
  const f = await ticketMoveFixture();
  const [first] = f.tickets;
  const create = () =>
    createTicketCommand.run(makeCommandContext({ storage: f.storage, params: {} }), { title: "New" });
  const move = () => moveTicketOnBoard(f.ctx, { rowId: first.id, attributes: {}, order: {} });
  const [creation, movement] = await Promise.allSettled([create(), move()]);
  expect(movement.status).toBe("fulfilled");
  // Creation can still report a busy order guard. Its retry must land on a free position.
  if (creation.status === "rejected") await create();
  const orders = (await ticketsCollection(f.storage).list()).map(({ position }) => position);
  expect(orders).toHaveLength(4);
  expect(new Set(orders).size).toBe(4);
});

test("milestone, status, and order save as one move and one completed event", async () => {
  const f = await ticketMoveFixture();
  const [first, hidden, last] = f.tickets;
  await f.storage.set("timeline.plan", { deadlines: [preview], order: [] });
  await moveTicketOnBoard(f.ctx, {
    rowId: last.id,
    attributes: { status: "done", milestone: preview.id },
    order: { beforeRowId: first.id },
  });
  expect(await milestoneOf(f.storage, last.id)).toBe(preview.id);
  expect(await ticketsCollection(f.storage).get(last.id)).toMatchObject({ statusId: "done" });
  expect(await f.ordered()).toEqual([last.id, first.id, hidden.id]);
  expect(f.writes).toEqual([last.id]);
  expect(f.events).toEqual(["tickets.changed"]);
});

test("an unchanged milestone keeps the plan and saves only the other values", async () => {
  const f = await ticketMoveFixture();
  const [first] = f.tickets;
  await f.storage.set("timeline.plan", { deadlines: [preview], order: [] });
  await moveTicketOnBoard(f.ctx, { rowId: first.id, attributes: { milestone: preview.id } });
  const plan = await planPlacements(f.storage).get(first.id);
  f.writes.length = 0;
  f.events.length = 0;
  await moveTicketOnBoard(f.ctx, { rowId: first.id, attributes: { status: "done", milestone: preview.id } });
  expect(await planPlacements(f.storage).get(first.id)).toEqual(plan);
  expect(f.writes).toEqual([first.id]);
  expect(f.events).toEqual(["tickets.changed"]);
});

test("a busy plan rejects a milestone move before changing the ticket", async () => {
  const f = await ticketMoveFixture();
  const [first, , last] = f.tickets;
  await f.storage.set("timeline.plan", { deadlines: [preview], order: [] });
  await withWriteGuard(f.ctx, "plan", async () => {
    await expect(
      moveTicketOnBoard(f.ctx, {
        rowId: last.id,
        attributes: { status: "done", milestone: preview.id },
        order: { beforeRowId: first.id },
      }),
    ).rejects.toThrow("Another Planner write");
  });
  expect(await milestoneOf(f.storage, last.id)).toBeNull();
  expect(await ticketsCollection(f.storage).get(last.id)).toEqual(last);
  expect(f.writes).toEqual([]);
  expect(f.events).toEqual([]);
});
