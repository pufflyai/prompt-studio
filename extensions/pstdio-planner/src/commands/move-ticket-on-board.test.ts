import { expect, test } from "bun:test";
import { ticketsCollection } from "../data/collections";
import { moveTicketOnBoard } from "./move-ticket-on-board";
import { ticketMoveFixture } from "./ticket-move.fixture";

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
    tagIds: ["default-priority-high"],
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
    sortOrder: first.sortOrder,
  });
  expect(f.writes).toEqual([first.id]);
  expect(f.events).toEqual(["tickets.changed"]);
});
