import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandArgs } from "../../commands/command-context.fixture";
import { createTicketCommand as createPlannerTicket } from "../../commands/create-ticket";
import { createTagOption, createTicketTag } from "../../data/tag-operations";
import { ticketContext, ticketsCollection } from "../../data/ticket-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { loadPlan } from "./plan-store";

test("creates timeline tickets through Planner with body, properties, prerequisites, and milestone", async () => {
  const storage = createMemoryStorage();
  const tag = await createTicketTag({ ...ticketContext(storage), name: "Track", type: "single_select" });
  const track = await createTagOption({ ...ticketContext(storage), tagId: tag.id, name: "Product" });
  const prerequisite = await createPlannerTicket.run(...makeCommandArgs({ storage, params: { content: "First" } }));
  const [ctx] = makeCommandArgs({ storage, params: {} });
  const deadline = { id: "preview", date: "2026-10-15", name: "Preview" };
  await storage.set("timeline.plan", { deadlines: [deadline], order: [] });
  const result = await createTicketCommand.run(ctx, {
    content: "# Shared ticket form\n\nDetails from the markdown body.",
    attributes: { status: "ready", [tag.id]: track.id, priority: "default-priority-high" },
    deadline: deadline.id,
    dependsOn: [prerequisite.shorthand],
  });

  expect(result.ticket.title).toBe("Shared ticket form");
  expect(result.ticket.content).toBe("# Shared ticket form\n\nDetails from the markdown body.");
  expect(result.ticket.statusId).toBe("ready");
  expect(result.ticket.tagIds).toEqual([track.id, "default-priority-high"]);
  expect(result.ticket.dependsOn).toEqual([prerequisite.id]);
  expect(result.placementError).toBeNull();
  expect((await loadPlan(ctx)).plan.order.find((entry) => entry.ticketId === result.ticket.id)?.deadlineId).toBe(
    deadline.id,
  );
});

test("refuses an unknown milestone before creating a ticket", async () => {
  const storage = createMemoryStorage();
  const [ctx] = makeCommandArgs({ storage, params: {} });
  await expect(createTicketCommand.run(ctx, { content: "# Work", deadline: "missing" })).rejects.toThrow(
    "Unknown deadline",
  );
  expect(await ticketsCollection(storage).list()).toHaveLength(0);
});

test("keeps the saved ticket when placement event delivery fails", async () => {
  const storage = createMemoryStorage();
  const [ctx] = makeCommandArgs({ storage, params: {} });
  const emit = ctx.events.emit;
  ctx.events.emit = async (event, payload) => {
    if (typeof event === "object" && event.id === "timeline.plan.changed") throw new Error("Event delivery failed");
    return emit(event, payload);
  };
  const result = await createTicketCommand.run(ctx, { content: "# Saved ticket" });
  expect(result.ticket.title).toBe("Saved ticket");
  expect(result.placementError).toContain("Event delivery failed");
  expect(await ticketsCollection(storage).list()).toHaveLength(1);
});
