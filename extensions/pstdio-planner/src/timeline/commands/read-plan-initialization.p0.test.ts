import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandContext } from "../../commands/command-context.fixture";
import { putTicket } from "../../data/ticket-context.fixture";
import type { Ticket } from "../../data/types";
import { moveTicketInPlan } from "./move-ticket";
import { planPlacements, readPlanMetadata } from "./placement-store";
import { readPlanCommand } from "./read-plan";

test("the first Timeline page initializes its execution prefix and continues without losing unloaded work", async () => {
  const storage = createMemoryStorage();
  const ids = Array.from({ length: 203 }, (_, i) => `ticket-${String(203 - i).padStart(4, "0")}`);
  let position: string | undefined;
  for (const [i, id] of [...ids, "archived"].entries()) {
    position = storage.positions.between(position);
    await putTicket(storage, {
      id,
      shorthand: `T-${i + 1}`,
      title: id,
      content: "Large body. ".repeat(100),
      statusId: "ready",
      archived: id === "archived",
      position,
      dependsOn: i === 0 ? [ids.at(-1)!] : [],
      createdAt: "before",
      updatedAt: "after",
    });
  }
  await readPlanMetadata(storage);
  for (const [i, ticketId] of [ids[0], "archived", "missing"].entries())
    await planPlacements(storage).put(ticketId, { ticketId, deadlineId: null, position: String(i) });
  const ctx = makeCommandContext({ storage, params: {} });
  const page = (offset: number) => ({ limit: 50, offset, fields: ["id"], search: "" });
  const first = await readPlanCommand.run(ctx, { page: page(0) });
  expect(first.ticketRows.map(({ id }) => id)).toEqual(ids.slice(0, 50));
  expect(first.page.total).toBe(203);
  expect(first.sections[0].globalCounts?.total).toBe(203);
  expect(first.sections[0].rows[0].flags).toContain("out-of-order");
  expect((await storage.records.aggregate({ index: "timeline-placements" })).count).toBe(103);

  const selected = await readPlanCommand.run(ctx, { ticketId: ids[20] });
  expect(selected.sections[0].rows[0]).toMatchObject({ id: ids[20], step: 21 });
  expect((await storage.records.aggregate({ index: "timeline-placements" })).count).toBe(103);
  await moveTicketInPlan(ctx, { ticket: ids[30], before: ids[31] });
  expect((await storage.records.aggregate({ index: "timeline-placements" })).count).toBe(103);

  await expect(
    readPlanCommand.run(ctx, {
      page: { ...page(0), limit: 100, cursor: first.page.cursor ?? undefined, revision: first.page.revision },
    }),
  ).rejects.toThrow("stale");

  // The existing continuation contract rejects a revision changed by initialization.
  // The renderer restarts the same offset once without its old cursor/revision.
  await expect(
    readPlanCommand.run(ctx, {
      page: { ...page(100), revision: first.page.revision },
    }),
  ).rejects.toThrow("stale");
  const later = await readPlanCommand.run(ctx, { page: page(100) });
  expect(later.ticketRows.map(({ id }) => id)).toEqual(ids.slice(100, 150));
  expect(later.sections[0].rows.map(({ step }) => step)).toEqual(Array.from({ length: 50 }, (_, i) => i + 101));
  expect((await storage.records.aggregate({ index: "timeline-placements" })).count).toBe(205);
  const last = await readPlanCommand.run(ctx, { page: page(200) });
  expect(last.ticketRows.map(({ id }) => id)).toEqual(ids.slice(200));
  expect(last.sections[0].globalCounts?.total).toBe(203);
});

test("a cycle broken in the first execution prefix still flags its unloaded later prerequisite", async () => {
  const storage = createMemoryStorage();
  const ids = Array.from({ length: 103 }, (_, i) => `cycle-${String(i).padStart(3, "0")}`);
  let position: string | undefined;
  for (const [i, id] of ids.entries()) {
    position = storage.positions.between(position);
    await putTicket(storage, {
      id,
      shorthand: `C-${i + 1}`,
      title: id,
      content: "",
      statusId: "ready",
      archived: false,
      position,
      dependsOn: [ids[(i + 1) % ids.length]],
      createdAt: "before",
      updatedAt: "after",
    });
  }
  const result = await readPlanCommand.run(makeCommandContext({ storage, params: {} }), {
    page: { limit: 1, offset: 0, fields: ["id"], search: "" },
  });
  expect(result.sections[0].rows[0]).toMatchObject({ id: ids[0], flags: ["waiting", "out-of-order"] });
  expect(await planPlacements(storage).get(ids[1])).toBeUndefined();
  expect(result.sections[0].counts.total).toBe(103);
});

test("archival during initialization cannot expose unordered pending tickets", async () => {
  const storage = createMemoryStorage();
  const tickets: Ticket[] = [];
  let position: string | undefined;
  for (let i = 0; i < 203; i++) {
    position = storage.positions.between(position);
    const ticket = {
      id: `ticket-${203 - i}`,
      shorthand: `T-${i + 1}`,
      title: "Ticket",
      content: "",
      statusId: "ready",
      archived: false,
      position,
      createdAt: "before",
      updatedAt: "after",
    };
    tickets.push(ticket);
    await putTicket(storage, ticket);
  }
  const commit = storage.records.commit;
  let archived = false;
  storage.records.commit = async (request) => {
    const result = await commit(request);
    if (!archived && request.edits.length === 100) {
      archived = true;
      for (const ticket of tickets.slice(0, 99)) await putTicket(storage, { ...ticket, archived: true });
    }
    return result;
  };
  const ctx = makeCommandContext({ storage, params: {} });
  const page = { limit: 100, offset: 0, fields: ["id"], search: "" };
  const result = await readPlanCommand.run(ctx, { page });
  expect(archived).toBe(true);
  expect(result.ticketRows.map(({ id }) => id)).toEqual(tickets.slice(99, 199).map(({ id }) => id));
  expect(result.page.total).toBe(104);

  const aggregate = storage.records.aggregate;
  let changed = false;
  storage.records.aggregate = async (request) => {
    const result = await aggregate(request);
    if (!changed && request.index === "timeline-placement-order") {
      changed = true;
      await putTicket(storage, { ...tickets[99], archived: true });
    }
    return result;
  };
  await expect(readPlanCommand.run(ctx, { page })).rejects.toThrow("stale");
});
