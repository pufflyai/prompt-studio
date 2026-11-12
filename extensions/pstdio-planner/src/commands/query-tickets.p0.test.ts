import { describe, expect, test } from "bun:test";
import { resourceKey } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { seedDefaultStatuses } from "../data/seed";
import { countStorageWrites } from "../data/storage-writes.fixture";
import { putTicket } from "../data/ticket-context.fixture";
import type { Ticket } from "../data/types";
import { commandParamsFor, makeCommandContext } from "./command-context.fixture";
import { queryTicketsCommand } from "./query-tickets";

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

  test("returns both archive states when the view has no archive filter", async () => {
    const storage = createMemoryStorage();
    await putTicket(storage, makeTicket({ archived: false, title: "Active" }));
    await putTicket(storage, makeTicket({ id: "ticket-2", shorthand: "T-2", archived: true, title: "Archived" }));

    const ctx = makeCommandContext({ storage, params: { filter: { conjunction: "and", rules: [] } } });
    const result = await queryTicketsCommand.run(ctx, commandParamsFor(ctx));

    expect(result.rows.map((row) => row.title)).toEqual(["Active", "Archived"]);
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

  test("projects incoming workspaces and outgoing artifacts into the same display preference", async () => {
    const storage = createMemoryStorage();
    await putTicket(storage, makeTicket({}));
    const ctx = makeCommandContext({ storage, params: {} });
    const ticket = { type: "ticket", id: "ticket-1", extensionId: "pstdio.planner", projectId: ctx.projectId };
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
