import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandContext } from "../../commands/command-context.fixture";
import { createTicketCommand } from "../../commands/create-ticket";
import { moveTicketOnBoard } from "../../commands/move-ticket-on-board";
import { queryTicketProperties } from "../../commands/ticket-properties/query";
import { ticketsCollection } from "../../data/collections";
import { ticketIdOfRecord } from "../../data/storage-reads.fixture";
import { moveTicket } from "../model/edit-plan";
import { deleteDeadlineCommand } from "./deadline-commands";
import { moveTicketInPlan } from "./move-ticket";
import { placeNewTicket } from "./place-new-ticket";
import { placementRecordId } from "./placement-records";
import { metadataKey, readPlanMetadata, writePlanMetadata } from "./placement-store";
import { loadPlan, readStoredPlan, savePlan, writeStoredPlan } from "./plan-store";
import { timelineViewSchema } from "./view-schema";

test("moving before an unplaced ticket preserves the resolved prefix", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const tickets = [];
  for (const title of ["A", "B", "C"]) tickets.push(await createTicketCommand.run(ctx, { title }));
  await moveTicketInPlan(ctx, { ticket: tickets[2].id, before: tickets[1].id });
  expect((await loadPlan(ctx)).plan.order.map(({ ticketId }) => ticketId)).toEqual([
    tickets[0].id,
    tickets[2].id,
    tickets[1].id,
  ]);
});

test("a failed deadline deletion preserves its existing assignments", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const ticket = await createTicketCommand.run(ctx, { title: "Release" });
  await writeStoredPlan(storage, {
    deadlines: [{ id: "release", date: "2030-01-01" }],
    order: [{ ticketId: ticket.id, deadlineId: "release" }],
  });
  const commit = storage.records.commit.bind(storage.records);
  storage.records.commit = (group) => {
    if (group.edits.some(({ recordId }) => recordId === storage.records.id("timeline.deadlines")))
      throw new Error("Metadata write refused");
    return commit(group);
  };
  await expect(deleteDeadlineCommand.run(ctx, { deadline: "release" })).rejects.toThrow("Metadata write refused");
  expect((await readStoredPlan(storage)).order).toEqual([{ ticketId: ticket.id, deadlineId: "release" }]);
});

test("moving a Board milestone reads only the selected ticket body", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const selected = await createTicketCommand.run(ctx, { title: "Selected" });
  await createTicketCommand.run(ctx, { title: "Unloaded" });
  await storage.set("timeline.plan", { deadlines: [{ id: "release", date: "2030-01-01" }], order: [] });
  await readPlanMetadata(storage);
  const read = storage.records.read.bind(storage.records);
  const readMany = storage.records.readMany.bind(storage.records);
  const check = (ids: string[]) => {
    for (const recordId of ids) {
      const ticketId = ticketIdOfRecord(recordId);
      if (ticketId && ticketId !== selected.id) throw new Error("Read an unloaded ticket body");
    }
  };
  storage.records.read = (id, ...rest) => {
    check([id]);
    return read(id, ...rest);
  };
  storage.records.readMany = (ids) => {
    check(ids);
    return readMany(ids);
  };
  await moveTicketOnBoard(ctx, { rowId: selected.id, attributes: { milestone: "release" } });
  expect((await readStoredPlan(storage)).order).toContainEqual({ ticketId: selected.id, deadlineId: "release" });
});

test("secondary panel metadata does not read every ticket placement", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const ticket = await createTicketCommand.run(ctx, { title: "Selected" });
  await writeStoredPlan(storage, {
    deadlines: [{ id: "release", date: "2030-01-01" }],
    order: [{ ticketId: ticket.id, deadlineId: "release" }],
  });
  const query = storage.records.query.bind(storage.records);
  storage.records.query = (input) => {
    if (input.index === "timeline-placements") throw new Error("Read every placement for panel metadata");
    return query(input);
  };
  const schema = await timelineViewSchema(ctx);
  expect(schema.attributes.map(({ id }) => id)).toContain("milestone");
  const properties = await queryTicketProperties(ctx, { type: "ticket", id: ticket.id });
  if (!("params" in properties) || !Array.isArray(properties.params)) throw new Error("Missing property controls");
  expect(properties.params.find(({ id }) => id === "milestone")?.defaultValue).toBe("release");
});

test("a refused plan publication leaves its order unchanged", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const tickets = [];
  for (const title of ["A", "B", "C"]) tickets.push(await createTicketCommand.run(ctx, { title }));
  const plan = { deadlines: [], order: tickets.map(({ id }) => ({ ticketId: id, deadlineId: null })) };
  await writeStoredPlan(storage, plan);
  const commit = storage.records.commit.bind(storage.records);
  storage.records.commit = (group) => {
    if (group.edits.some(({ recordId }) => recordId === storage.records.id("timeline.deadlines")))
      throw new Error("Plan publication refused");
    return commit(group);
  };
  await expect(
    writeStoredPlan(storage, { ...plan, order: [plan.order[2], plan.order[0], plan.order[1]] }),
  ).rejects.toThrow("Plan publication refused");
  expect(await readStoredPlan(storage)).toEqual(plan);
});

test("an unscheduled Timeline creation follows existing unplaced tickets", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const first = await createTicketCommand.run(ctx, { title: "A" });
  const second = await createTicketCommand.run(ctx, { title: "B" });
  const { ticket } = await placeNewTicket(ctx, "none", async () => createTicketCommand.run(ctx, { title: "C" }));
  expect((await loadPlan(ctx)).plan.order.map(({ ticketId }) => ticketId)).toEqual([first.id, second.id, ticket.id]);
});

test("archived Board tickets cannot acquire a milestone", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const ticket = await createTicketCommand.run(ctx, { title: "Archived" });
  await ticketsCollection(ctx).change(ticket.id, async (current) => ({ ...current, archived: true }));
  await storage.set("timeline.plan", { deadlines: [{ id: "release", date: "2030-01-01" }], order: [] });
  await expect(moveTicketOnBoard(ctx, { rowId: ticket.id, attributes: { milestone: "release" } })).rejects.toThrow();
  expect((await readStoredPlan(storage)).order).toEqual([]);
});

test("a 5000-ticket plan publishes atomically and a reorder preserves unaffected positions", async () => {
  const storage = createMemoryStorage();
  await readPlanMetadata(storage);
  const plan = {
    deadlines: [],
    order: Array.from({ length: 5000 }, (_, i) => ({ ticketId: `ticket-${i}`, deadlineId: null })),
  };
  await writeStoredPlan(storage, plan);
  const firstId = placementRecordId(storage, "ticket-0");
  const secondId = placementRecordId(storage, "ticket-1");
  const before = await storage.records.readMany([firstId, secondId]);
  const reordered = { ...plan, order: [plan.order[4999], ...plan.order.slice(0, 4999)] };
  await writeStoredPlan(storage, reordered);
  expect(await readStoredPlan(storage)).toEqual(reordered);
  const after = await storage.records.readMany([firstId, secondId]);
  expect(after.map(({ value }) => value)).toEqual(before.map(({ value }) => value));
  expect(after.map(({ revision }) => revision)).toEqual(before.map(({ revision }) => revision));
});

test("an order edit cannot resurrect a deadline deleted after its read", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const ticket = await createTicketCommand.run(ctx, { title: "Selected" });
  await writeStoredPlan(storage, {
    deadlines: [{ id: "release", date: "2030-01-01" }],
    order: [{ ticketId: ticket.id, deadlineId: "release" }],
  });
  const loaded = await loadPlan(ctx);
  await writePlanMetadata(storage, { deadlines: [] });
  await expect(
    savePlan(ctx, moveTicket(loaded.plan, { ticketId: ticket.id, deadlineId: "release" }), "move", loaded.snapshot),
  ).rejects.toThrow();
  expect((await readStoredPlan(storage)).deadlines).toEqual([]);
});

test("placement migration preserves an already-published catalog without legacy input", async () => {
  const storage = createMemoryStorage();
  const deadlines = [{ id: "release", date: "2030-01-01" }];
  await storage.set(metadataKey, { deadlines });
  expect((await readPlanMetadata(storage)).deadlines).toEqual(deadlines);
});

test("placement migration retires legacy input only after its version is durable", async () => {
  const storage = createMemoryStorage();
  const legacy = {
    deadlines: [{ id: "release", date: "2030-01-01" }],
    order: [{ ticketId: "planned", deadlineId: "release" }],
  };
  await storage.set("timeline.plan", legacy);
  const scope = storage.scope.bind(storage);
  let interrupted = false;
  storage.scope = (input) => {
    const child = scope(input);
    if (input.type !== "migration" || input.id !== "timeline.placements") return child;
    return {
      ...child,
      migrate: (version, migrate) =>
        child.migrate(version, async (previous, context) => {
          await migrate(previous, context);
          if (!interrupted) {
            interrupted = true;
            throw new Error("Interrupted before migration version publication");
          }
        }),
    };
  };
  await expect(readPlanMetadata(storage)).rejects.toThrow("Interrupted before migration version publication");
  expect(await storage.get("timeline.plan")).toEqual(legacy);
  expect((await readPlanMetadata(storage)).deadlines).toEqual(legacy.deadlines);
  expect(await readStoredPlan(storage)).toEqual(legacy);
  expect(await storage.get("timeline.plan")).toBeUndefined();
});
