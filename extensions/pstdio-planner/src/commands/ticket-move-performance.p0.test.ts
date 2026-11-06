import { expect, test } from "bun:test";
import { ticketsCollection } from "../data/ticket-context.fixture";

import { reorderTicket } from "./reorder-ticket";
import { ticketMoveFixture } from "./ticket-move.fixture";

test("filtered ordering writes only the moved ticket and returns no full tickets", async () => {
  const f = await ticketMoveFixture();
  const [first, hidden, last] = f.tickets;
  const result = await reorderTicket(f.ctx, { rowId: last.id, beforeRowId: first.id });
  expect(await f.ordered()).toEqual([last.id, first.id, hidden.id]);
  expect(f.writes).toEqual([last.id]);
  expect(f.events).toEqual(["tickets.changed"]);
  expect(JSON.stringify(result).length).toBeLessThan(100);
  expect(await ticketsCollection(f.storage).get(hidden.id)).toEqual(hidden);
});

test("no-op and self-target moves write and emit nothing", async () => {
  const f = await ticketMoveFixture();
  const [first, hidden, last] = f.tickets;
  await reorderTicket(f.ctx, { rowId: first.id, beforeRowId: hidden.id });
  await reorderTicket(f.ctx, { rowId: first.id, beforeRowId: first.id });
  await reorderTicket(f.ctx, { rowId: last.id });
  expect(f.writes).toEqual([]);
  expect(f.events).toEqual([]);
});

test("successive moves into one gap keep neighbours and write only moved cards", async () => {
  const f = await ticketMoveFixture();
  const [first, hidden, last] = f.tickets;
  await reorderTicket(f.ctx, { rowId: last.id, beforeRowId: hidden.id });
  await reorderTicket(f.ctx, { rowId: first.id, beforeRowId: hidden.id });
  expect(await f.ordered()).toEqual([last.id, first.id, hidden.id]);
  const orders = (await ticketsCollection(f.storage).list()).map(({ position }) => position);
  expect(new Set(orders).size).toBe(3);
  expect(f.writes).toEqual([last.id, first.id]);
  expect(await ticketsCollection(f.storage).get(hidden.id)).toEqual(hidden);
});

test("concurrent moves cannot assign the same position", async () => {
  const f = await ticketMoveFixture();
  const [first, hidden, last] = f.tickets;
  const outcomes = await Promise.allSettled([
    reorderTicket(f.ctx, { rowId: last.id, beforeRowId: first.id }),
    reorderTicket(f.ctx, { rowId: hidden.id, beforeRowId: first.id }),
  ]);
  expect(outcomes.filter(({ status }) => status === "fulfilled").length).toBe(1);
  expect((outcomes.find(({ status }) => status === "rejected") as PromiseRejectedResult).reason.message).toContain(
    "Another Planner write",
  );
  await reorderTicket(f.ctx, { rowId: hidden.id, beforeRowId: first.id });
  const orders = (await ticketsCollection(f.storage).list()).map(({ position }) => position);
  expect(new Set(orders).size).toBe(3);
});
