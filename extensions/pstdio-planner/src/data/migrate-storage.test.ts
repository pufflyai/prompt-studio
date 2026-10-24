import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import extension from "../../extension";
import { makeCommandContext } from "../commands/command-context.fixture";
import { queryTicketProperties } from "../commands/ticket-properties/query";
import { timelineViewSchema } from "../timeline/commands/view-schema";
import { TICKETS_COLLECTION, tagsCollection } from "./collections";
import { migratePlannerStorage } from "./migrate-storage";
import { putTicket, seedTicketIdentity, ticketsCollection } from "./ticket-context.fixture";
import type { Ticket } from "./types";

const registered = (id: string) => {
  const contribution = [...(extension.commands ?? []), ...(extension.hooks ?? [])].find((entry) => entry.id === id);
  if (!contribution) throw new Error(`Missing ${id}`);
  return contribution as unknown as { run: (ctx: unknown, input: unknown) => Promise<unknown> };
};

const ticket = {
  id: "ticket-1",
  shorthand: "PS-1",
  title: "Ticket",
  content: "# Ticket",
  statusId: "ready",
  archived: false,
  sortOrder: 0,
  createdAt: "2026-10-02T09:00:00.000Z",
  updatedAt: "2026-10-02T09:00:00.000Z",
  parallelizable: "no",
} as Ticket;

test("a project that already imported its templates gets the remaining cleanups once", async () => {
  const storage = createMemoryStorage({
    legacyData: {
      templates: {
        version: "0027-before-removal",
        records: [{ id: "file", name: "custom", template_type: "prompt", file_id: "file", deleted_at: null }],
      },
    },
  });
  await storage.migrate(1, async () => {});
  await putTicket(storage, ticket);
  await storage.set("workspace-status-definitions-initialized", true);
  const ctx = makeCommandContext({ storage, params: {} });

  await migratePlannerStorage(ctx);

  expect(await ticketsCollection(storage).get(ticket.id)).not.toHaveProperty("parallelizable");
  expect(await storage.get("workspace-status-definitions-initialized")).toBeUndefined();
  expect(await storage.collection("templates").list()).toEqual([]);
});

// Commands and hooks can run from the CLI or an event before any Planner view opens.
test.each([
  "migration",
  "get-ticket",
  "timeline.plan.read",
  "ticket-tag.read",
  "review-request-cleanup",
  "schema",
  "properties",
])("%s upgrades preserve custom flags, ticket edits, and requests", async (entry) => {
  const storage = createMemoryStorage();
  await storage.migrate(2, async () => {});
  const option = { id: "custom-flag", name: "Follow up", color: "blue", sortOrder: 1, icon: null, description: null };
  await tagsCollection(storage).put("default-human-requested", {
    id: "default-human-requested",
    name: "Workflow",
    type: "multi_select",
    sortOrder: 3,
    options: [{ ...option, id: "default-human-requested-true", name: "Needs attention" }, option],
  });
  const original = { ...ticket, tagIds: ["default-human-requested-true", option.id], content: "Keep this body" };
  // An older build stored the flat list.
  seedTicketIdentity(storage, ticket);
  await storage.collection(TICKETS_COLLECTION).put(ticket.id, original);
  const requests = storage.collection("planner-review-requests");
  const request = { id: "request", ticketId: ticket.id, title: "Choose the scope" };
  await requests.put(request.id, request);
  const ctx = makeCommandContext({ storage, params: {} });

  if (entry === "schema") await timelineViewSchema(ctx);
  else if (entry === "properties") await queryTicketProperties(ctx, { type: "ticket", id: ticket.id });
  else if (entry === "migration") await migratePlannerStorage(ctx);
  else await registered(entry).run(ctx, entry === "get-ticket" ? { id: ticket.id } : { ticketId: "other" });

  expect(await tagsCollection(storage).get("default-human-requested")).toMatchObject({
    name: "Workflow",
    options: [option],
  });
  expect(await ticketsCollection(storage).get(ticket.id)).toMatchObject({
    content: "Keep this body",
    tags: { "default-human-requested": [option.id] },
  });
  expect(await requests.get(request.id)).toEqual(request);
  await migratePlannerStorage(ctx);
  expect(await requests.get(request.id)).toEqual(request);
});
