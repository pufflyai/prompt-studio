import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandArgs } from "../../commands/command-context.fixture";
import { createTicketCommand as createPlannerTicket } from "../../commands/create-ticket";
import { ticketsCollection } from "../../data/collections";
import { createTagOption, createTicketTag } from "../../data/tag-operations";
import { createTicketCommand } from "./create-ticket";
import { loadPlan } from "./plan-store";

test("creates timeline tickets through Planner with body, properties, prerequisites, and milestone", async () => {
  const storage = createMemoryStorage();
  const tag = await createTicketTag({ storage, name: "Track", type: "single_select" });
  const track = await createTagOption({ storage, tagId: tag.id, name: "Product" });
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

test("returns the created ticket when releasing the write claim fails", async () => {
  const storage = createMemoryStorage();
  const [ctx] = makeCommandArgs({ storage, params: {} });
  const collection = storage.collection.bind(storage);
  // Fault injection keeps real storage and ticket creation; only the failing write is replaced.
  storage.collection = ((name: string) => {
    const real = collection(name);
    if (name !== "timeline.write-claims") return real;
    return {
      ...real,
      deleteIfValue: async () => {
        throw new Error("Storage unavailable");
      },
    };
  }) as typeof storage.collection;
  const result = await createTicketCommand.run(ctx, { content: "# Saved ticket" });
  expect(result.ticket.title).toBe("Saved ticket");
  expect(result.placementError).toContain("Write claim release failed");
  expect(await ticketsCollection(storage).list()).toHaveLength(1);
});
