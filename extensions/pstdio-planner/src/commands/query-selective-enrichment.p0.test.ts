import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { TICKET_LINKED_RESOURCE_ITEMS_ATTRIBUTE } from "../data/ticket-linked-resources";
import { createDeadlineCommand } from "../timeline/commands/deadline-commands";
import { moveTicketCommand } from "../timeline/commands/move-ticket";
import { readPlanCommand } from "../timeline/commands/read-plan";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { queryTickets } from "./query-tickets";

const board = (displayProperties: string[]) => ({
  page: { limit: 100, offset: 0, fields: ["id", "status"], search: "" },
  settings: { viewMode: "board" as const, columnGrouping: "status", rowGrouping: "none", displayProperties },
});

const fixture = async () => {
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: { extensionId: "pstdio.planner" },
  });
  const ticket = await createTicketCommand.run(ctx, { title: "Work", statusId: "done" });
  const deadline = (await createDeadlineCommand.run(ctx, { name: "Milestone", date: "2030-01-01" }))!;
  await moveTicketCommand.run(ctx, { ticket: ticket.id, deadline: deadline.id });
  return { ctx, ticket };
};

test("Board skips undisplayed relationship and milestone-progress providers", async () => {
  const { ctx } = await fixture();
  const aggregate = ctx.storage.records.aggregate.bind(ctx.storage.records);
  let progressReads = 0;
  ctx.storage.records.aggregate = (query) => {
    if (query.groupBy === "deadlineId") progressReads++;
    return aggregate(query);
  };
  ctx.resources.queryAnchorsMany = async () => {
    throw new Error("Undisplayed relationship read");
  };
  ctx.resources.queryRelated = async () => {
    throw new Error("Undisplayed relationship read");
  };
  const result = await queryTickets(ctx, board(["id"]));
  expect(result.rows).toHaveLength(1);
  expect(progressReads).toBe(0);
});

test("hidden milestone-progress filters still compute their dependency", async () => {
  const { ctx, ticket } = await fixture();
  const result = await queryTickets(ctx, {
    ...board(["id"]),
    filter: { conjunction: "and", rules: [{ attributeId: "milestoneState", condition: "is", value: "complete" }] },
  });
  expect(result.rows.map(({ id }) => id)).toEqual([ticket.id]);
  expect(result.page?.total).toBe(1);
});

test("Board bounds relationship previews and retains a full continuation action", async () => {
  const { ctx, ticket } = await fixture();
  await ctx.resources.addAnchors(
    { type: "ticket", id: ticket.id, projectId: ctx.projectId, extensionId: ctx.extensionId },
    Array.from({ length: 105 }, (_, i) => ({
      type: "note",
      id: String(i),
      label: `Note ${i}`,
      extensionId: "pstdio.notes",
      projectId: ctx.projectId,
    })),
  );
  const sizes: number[] = [];
  ctx.resources.resolveOpenings = async (refs) => {
    sizes.push(refs.length);
    return [];
  };
  const result = await queryTickets(ctx, board(["workspace"]));
  const items = result.rows[0]!.attributes[TICKET_LINKED_RESOURCE_ITEMS_ATTRIBUTE] as {
    id: string;
    action?: unknown;
  }[];
  expect(items).toHaveLength(9);
  expect(items.at(-1)).toMatchObject({ id: "linked-resources-more", action: { kind: "page" } });
  expect(sizes).toEqual([8]);
});

test("Timeline graph admission does not load card relationships", async () => {
  const { ctx } = await fixture();
  ctx.resources.queryAnchorsMany = async () => {
    throw new Error("Graph eagerly loaded relationships");
  };
  ctx.resources.queryRelated = async () => {
    throw new Error("Graph eagerly loaded relationships");
  };
  const result = await readPlanCommand.run(ctx, { fields: [] } as never);
  expect(result.ticketRows).toHaveLength(1);
  expect(result.sections.flatMap(({ rows }) => rows)).toHaveLength(1);
});

test("Timeline previews select active visible identities and preserve full related-resource pages", async () => {
  const { ctx, ticket } = await fixture();
  const { readTicketPreviewsCommand } = await import("../timeline/commands/ticket-previews");
  const { readTicketLinkedResourcePage } = await import("../data/ticket-linked-resources");
  const ref = { type: "ticket", id: ticket.id, extensionId: ctx.extensionId, projectId: ctx.projectId };
  const linked = Array.from({ length: 105 }, (_, index) => ({
    type: "note",
    id: String(index),
    extensionId: "pstdio.notes",
    projectId: ctx.projectId,
    label: `Note ${index}`,
  }));
  await ctx.resources.addAnchors(ref, linked);
  const previews = await readTicketPreviewsCommand.run(ctx, { ticketIds: [ticket.id, ticket.id, "unknown"] });
  expect(previews).toHaveLength(1);
  expect(previews[0]!.attributes.linkedResourceItems).toHaveLength(9);
  const first = await readTicketLinkedResourcePage(ctx.resources, ref);
  const second = await readTicketLinkedResourcePage(ctx.resources, ref, first.nextCursor);
  expect(first.items).toHaveLength(100);
  expect(first.nextCursor).toBeString();
  expect(second.items).toHaveLength(5);
  expect(second.nextCursor).toBeUndefined();
  expect(new Set([...first.items, ...second.items].map(({ id }) => id)).size).toBe(105);
  await expect(readTicketPreviewsCommand.run(ctx, { ticketIds: Array(101).fill(ticket.id) })).rejects.toThrow("100");
});

test("Timeline refuses mixed-generation relationship previews", async () => {
  const { ctx, ticket } = await fixture();
  const { readTicketPreviewsCommand } = await import("../timeline/commands/ticket-previews");
  const { updateTicketCommand } = await import("./update-ticket");
  const query = ctx.resources.queryRelated;
  let changed = false;
  ctx.resources.queryRelated = async (input) => {
    if (!changed) {
      changed = true;
      await updateTicketCommand.run(ctx, { id: ticket.id, content: "# Concurrent edit" });
    }
    return query(input);
  };
  await expect(readTicketPreviewsCommand.run(ctx, { ticketIds: [ticket.id] })).rejects.toThrow(/revision/i);
});

test("legacy review links share the preview bound and retain the child's normal navigation", async () => {
  const { ctx, ticket } = await fixture();
  const { ticketsCollection } = await import("../data/ticket-context.fixture");
  const { updateTicketCommand } = await import("./update-ticket");
  const { readTicketPreviewsCommand } = await import("../timeline/commands/ticket-previews");
  const parent = await createTicketCommand.run(ctx, { title: "Parent" });
  await updateTicketCommand.run(ctx, { id: ticket.id, parent: parent.id });
  const records = ticketsCollection(ctx.storage),
    current = (await records.get(ticket.id))!;
  await records.put(ticket.id, {
    ...current,
    reviewLinks: Array.from({ length: 12 }, (_, index) => ({
      id: String(index),
      url: `https://github.com/acme/project/pull/${index + 1}`,
      provider: "github",
      kind: "pull_request",
      externalId: String(index + 1),
      title: null,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    })),
  });
  const boardResult = await queryTickets(ctx, board(["workspace"]));
  const row = boardResult.rows.find(({ id }) => id === ticket.id)!;
  const items = row.attributes.linkedResourceItems as { id: string; action?: unknown }[];
  expect(items).toHaveLength(9);
  expect(items.at(-1)?.action).toEqual(row.target);
  expect(row.target.parent?.resource?.id).toBe(parent.id);
  const preview = (await readTicketPreviewsCommand.run(ctx, { ticketIds: [ticket.id] }))[0]!;
  expect(preview.attributes.linkedResourceItems).toHaveLength(9);
  expect((await records.get(ticket.id))?.reviewLinks).toHaveLength(12);
});
