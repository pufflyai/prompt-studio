import { describe, expect, spyOn, test } from "bun:test";
import { resourceKey } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { putStatus, putTag } from "../data/collections";
import { seedDefaultStatuses } from "../data/seed";
import { countStorageWrites } from "../data/storage-writes.fixture";
import { createTicketRecordStorage, putTicket } from "../data/ticket-context.fixture";
import { ticketRecords } from "../data/ticket-records";
import type { Ticket } from "../data/types";
import { commandParamsFor, makeCommandContext } from "./command-context.fixture";
import { queryTickets, queryTicketsCommand } from "./query-tickets";

const makeTicket = (overrides: Partial<Ticket>): Ticket => ({
  id: "ticket-1",
  shorthand: "T-1",
  title: "Ticket",
  content: "",
  statusId: null,
  archived: false,
  sortOrder: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("queryTicketsCommand", () => {
  test("reading the board writes nothing once Planner storage is up to date", async () => {
    const { storage, counter } = countStorageWrites(createMemoryStorage());
    await putTicket(storage, makeTicket({ title: "Active" }));
    const ctx = makeCommandContext({ storage, params: { filter: { conjunction: "and", rules: [] } } });
    await queryTicketsCommand.run(ctx, commandParamsFor(ctx));
    counter.writes = 0;

    const result = await queryTicketsCommand.run(ctx, commandParamsFor(ctx));

    expect(result.rows.map((row) => row.title)).toEqual(["Active"]);
    expect(counter.writes).toBe(0);
  });

  test("reads current filter options without fetching tickets or linked resources", async () => {
    const storage = createMemoryStorage();
    await putTicket(storage, makeTicket({}));
    const ctx = makeCommandContext({ storage, params: {} });
    const initial = await queryTickets(ctx, {});
    await storage.set("timeline.plan", {
      deadlines: [
        { id: "later", date: "2026-12-01" },
        { id: "earlier", date: "2026-11-20" },
      ],
      order: [],
    });
    const [firstStatus] = await seedDefaultStatuses(storage);
    await putStatus(storage, { ...firstStatus, name: "Renamed status" });
    await putTag(storage, { id: "custom", name: "Priority", type: "single_select", sortOrder: 7, options: [] });
    const full = await queryTickets(ctx, {});
    expect(full.rows).toHaveLength(1);
    expect(full.attributes).not.toEqual(initial.attributes);
    const query = spyOn(storage.records, "query");
    const reads = spyOn(storage.records, "readMany");
    const identities = spyOn(ctx.resources, "identityMany");
    const fields = await queryTickets(ctx, { fieldsOnly: true });
    expect(fields.attributes).toEqual(full.attributes);
    expect(fields.rows).toEqual([]);
    expect(query.mock.calls.filter(([request]) => request.index === "ticket-records")).toHaveLength(0);
    expect(reads).not.toHaveBeenCalled();
    expect(identities).not.toHaveBeenCalled();
  });

  test("passes archived filter values to the tickets query", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    await putTicket(storage, makeTicket({ archived: false, title: "Active" }));
    await putTicket(storage, makeTicket({ id: "ticket-2", shorthand: "T-2", archived: true, title: "Archived" }));

    const ctx = makeCommandContext({
      storage,
      params: {
        filter: {
          conjunction: "and",
          rules: [{ attributeId: "archived", condition: "is-any-of", value: ["archived"] }],
        },
      },
    });

    const result = await queryTicketsCommand.run(ctx, commandParamsFor(ctx));

    expect(result.rows.map((row) => row.title)).toEqual(["Archived"]);
  });

  test.each([
    "pstdio.pstdio-planner",
    "pstdio.planner",
  ])("projects incoming workspaces and outgoing artifacts for host owner %s", async (extensionId) => {
    const storage = createMemoryStorage();
    await putTicket(storage, makeTicket({}));
    const ctx = makeCommandContext({ storage, params: {}, overrides: { extensionId } });
    const ticket = { type: "ticket", id: "ticket-1", extensionId, projectId: ctx.projectId };
    const workspace = {
      type: "workspace",
      id: "workspace",
      extensionId: "pstdio",
      projectId: ctx.projectId,
      label: "Working copy",
    };
    const artifact = {
      type: "artifact",
      id: "artifact",
      extensionId: "example.artifacts",
      projectId: ctx.projectId,
      label: "Prototype",
    };
    await ctx.resources.addAnchors(workspace, [ticket]);
    await ctx.resources.addAnchors(ticket, [artifact]);
    ctx.resources.resolveMany = async (refs) =>
      refs.map((resource) => ({
        resource: { ...resource, icon: "folder" },
        target: { kind: "page", page: { kind: "page", id: "resource", extensionId: resource.extensionId }, resource },
      }));
    const result = await queryTicketsCommand.run(ctx, commandParamsFor(ctx));
    expect(result.rows[0]?.attributes.linkedResourceItems).toHaveLength(2);
    expect((result.rows[0]?.attributes.linkedResourceItems as { id: string }[]).map((item) => item.id).sort()).toEqual(
      [resourceKey(workspace), resourceKey(artifact)].sort(),
    );
    expect(result.attributes?.find((field) => field.id === "workspace")?.display).toEqual({
      kind: "badge-list",
      itemsAttributeId: "linkedResourceItems",
    });
  });
});

test("lists a large board using full index pages and bounded record reads", async () => {
  const tickets = Array.from({ length: 503 }, (_, i) => makeTicket({ id: `ticket-${String(i).padStart(3, "0")}` }));
  const storage = await createTicketRecordStorage(tickets);
  const query = spyOn(storage.records, "query");
  const reads = spyOn(storage.records, "readMany");
  const listed = await ticketRecords(storage).list();
  expect(listed.map((ticket) => ticket.id)).toEqual(tickets.map((ticket) => ticket.id));
  expect(query.mock.calls.filter(([request]) => request.index === "ticket-records")).toHaveLength(2);
  expect(reads.mock.calls.map(([ids]) => ids.length)).toEqual([100, 100, 100, 100, 100, 3]);
});
