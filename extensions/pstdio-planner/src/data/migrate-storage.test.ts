import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandContext } from "../commands/command-context.fixture";
import { queryTicketProperties } from "../commands/ticket-properties/query";
import { readTicketTagsCommand } from "../commands/ticket-tags";
import { readPlanCommand } from "../timeline/commands/read-plan";
import { timelineViewSchema } from "../timeline/commands/view-schema";
import { putTicket, tagsCollection, ticketsCollection } from "./collections";
import { migratePlannerStorage } from "./migrate-storage";
import type { StoredTicket } from "./types";

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
} as StoredTicket;

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

test.each([
  "migration",
  "timeline",
  "tags",
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
  await ticketsCollection(storage).put(ticket.id, original);
  const requests = storage.collection("planner-review-requests");
  const request = { id: "request", ticketId: ticket.id, title: "Choose the scope" };
  await requests.put(request.id, request);
  const ctx = makeCommandContext({ storage, params: {} });

  if (entry === "timeline") await readPlanCommand.run(ctx, {});
  else if (entry === "tags") await readTicketTagsCommand.run(ctx, {});
  else if (entry === "schema") await timelineViewSchema(ctx);
  else if (entry === "properties") await queryTicketProperties(ctx, { type: "ticket", id: ticket.id });
  else await migratePlannerStorage(ctx);

  expect(await tagsCollection(storage).get("default-human-requested")).toMatchObject({
    name: "Workflow",
    options: [option],
  });
  expect(await ticketsCollection(storage).get(ticket.id)).toMatchObject({
    content: "Keep this body",
    tagIds: [option.id],
  });
  expect(await requests.get(request.id)).toEqual(request);
  await migratePlannerStorage(ctx);
  expect(await requests.get(request.id)).toEqual(request);
});
