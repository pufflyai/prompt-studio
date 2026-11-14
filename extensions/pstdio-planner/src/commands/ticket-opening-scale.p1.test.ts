import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { withDerivedTicketState } from "../data/collections";
import { listTicketReviewRequests, readTicketReviewRequests } from "../data/review-request-storage";
import { seedTicketIdentity } from "../data/ticket-context.fixture";
import type { Ticket } from "../data/types";
import { makeCommandContext } from "./command-context.fixture";
import { getTicketContent } from "./get-ticket-content";
import { listTicketFilesTree } from "./ticket-files";
import { listTicketFilesPage } from "./ticket-files-page";

const ticket = (id: string, extra: Partial<Ticket> = {}): Ticket => ({
  id,
  shorthand: `T-${id}`,
  title: id,
  content: `Body ${id}`,
  statusId: "backlog",
  tags: {},
  archived: false,
  createdAt: "2026-11-14",
  updatedAt: "2026-11-14",
  ...extra,
});

test("unreadable requests retain attention and other collections never become requests", async () => {
  const storage = createMemoryStorage({
    collections: {
      "planner-review-requests": { broken: { ticketId: "selected" } },
      "planner-attempts": { attempt: { id: "attempt", ticketId: "selected" } },
    },
  });
  expect(await listTicketReviewRequests(storage, "selected")).toEqual(
    (await readTicketReviewRequests(storage)).get("selected")!,
  );
});

test("opening properties resolves only normalized linked dependencies for dependency-only blockers", async () => {
  const prerequisite = ticket("prerequisite", { shorthand: "T-1" });
  const selected = ticket("selected", {
    dependsOn: [" PREREQUISITE "],
    blockedReason: "Complete T-1 before implementing this dependent contract.",
  });
  const storage = createMemoryStorage({ collections: { tickets: { prerequisite, selected } } });
  for (const row of [prerequisite, selected]) seedTicketIdentity(storage, row);
  const collection = storage.collection.bind(storage);
  storage.collection = <T>(name: string) => ({
    ...collection<T>(name),
    list: async () => {
      throw new Error("Properties must not load all tickets");
    },
  });
  const ctx = makeCommandContext({ storage, params: {} });
  expect((await withDerivedTicketState(ctx, selected)).blockedReason).toBeNull();
  expect((await withDerivedTicketState(ctx, { ...selected, dependsOn: [" t-1 "] })).blockedReason).toBeNull();
});

test("related titles come from current synced content and empty identity pages retain their cursor", async () => {
  const selected = ticket("parent");
  const children = Array.from({ length: 101 }, (_, index) =>
    ticket(`child-${String(index).padStart(3, "0")}`, {
      parentId: selected.id,
      title: "Old title",
      content: "# Updated by another device\n\nBody",
    }),
  );
  const storage = createMemoryStorage({
    collections: { tickets: Object.fromEntries([selected, ...children].map((row) => [row.id, row])) },
  });
  seedTicketIdentity(storage, selected);
  seedTicketIdentity(storage, children[100]);
  const ctx = makeCommandContext({ storage, params: {} });
  const renderer = { rendererId: "ticket-files", resource: { type: "ticket", id: selected.id } };
  const section = (await listTicketFilesTree(ctx, { renderer })).find(({ id }) => id === "sub-tickets")!;
  expect(section.nodes).toEqual([]);
  expect(section.nextCursor).toBeDefined();
  const page = await listTicketFilesPage(ctx, {
    renderer,
    parent: { kind: "section", id: "sub-tickets" },
    cursor: section.nextCursor!,
  });
  expect(page.nodes).toHaveLength(1);
  expect(page.nodes[0].label).toContain("Updated by another device");
});

test("ticket relationship pages retain every child and dependent without duplicates", async () => {
  const selected = ticket("selected");
  const children = Array.from({ length: 105 }, (_, index) =>
    ticket(`child-${String(index).padStart(3, "0")}`, {
      parentId: selected.id,
      dependsOn: [selected.id],
    }),
  );
  const rows = [selected, ...children, ticket("scalar", { dependsOn: selected.id })];
  const storage = createMemoryStorage({
    collections: { tickets: Object.fromEntries(rows.map((row) => [row.id, row])) },
  });
  for (const row of rows) seedTicketIdentity(storage, row);
  const ctx = makeCommandContext({ storage, params: {} });
  const renderer = { rendererId: "ticket-files", resource: { type: "ticket", id: selected.id } };
  const sections = await listTicketFilesTree(ctx, { renderer });
  for (const sectionId of ["sub-tickets", "required-by"]) {
    const first = sections.find(({ id }) => id === sectionId)!;
    expect(first.nodes).toHaveLength(100);
    const ids = first.nodes.map((node) => node.resource!.id);
    let cursor = first.nextCursor;
    while (cursor) {
      const page = await listTicketFilesPage(ctx, { renderer, parent: { kind: "section", id: sectionId }, cursor });
      expect(page.nodes.length).toBeLessThanOrEqual(100);
      ids.push(...page.nodes.map((node) => node.resource!.id));
      cursor = page.nextCursor;
    }
    const expected = children.map(({ id }) => id);
    if (sectionId === "required-by") expected.push("scalar");
    expect(ids.sort()).toEqual(expected.sort());
    expect(new Set(ids).size).toBe(ids.length);
  }
});

test("opening a ticket with 5,000 records reads only its content and related navigation data", async () => {
  const selected = ticket("selected", { parentId: "parent", dependsOn: ["dependency"] });
  const related = [
    selected,
    ticket("parent"),
    ticket("dependency"),
    ticket("child", { parentId: selected.id }),
    ticket("dependent", { dependsOn: [selected.id] }),
    ticket("legacy", { dependsOn: selected.shorthand }),
    ticket("archived-child", { parentId: selected.id, archived: true }),
  ];
  const rows = [...related, ...Array.from({ length: 5000 - related.length }, (_, index) => ticket(`other-${index}`))];
  const storage = createMemoryStorage({
    collections: { tickets: Object.fromEntries(rows.map((row) => [row.id, row])) },
  });
  for (const row of related) seedTicketIdentity(storage, row);
  const collection = storage.collection.bind(storage);
  const reads: string[] = [];
  storage.collection = <T>(name: string) => {
    const records = collection<T>(name);
    return {
      ...records,
      get: async (id: string) => {
        reads.push(`${name}/${id}`);
        return records.get(id);
      },
      list: async () => {
        if (["tickets", "planner-review-requests", "planner-review-request-outcomes"].includes(name))
          throw new Error(`Opening a ticket must not list ${name}`);
        return records.list();
      },
    };
  };
  const ctx = makeCommandContext({ storage, params: {} });
  const resource = { type: "ticket", id: selected.id };
  expect(await getTicketContent(ctx, { resource })).toMatchObject({ content: selected.content });
  const sections = await listTicketFilesTree(ctx, { renderer: { rendererId: "ticket-files", resource } });
  expect(sections.find(({ id }) => id === "parent")?.nodes[0].resource?.id).toBe("parent");
  expect(sections.find(({ id }) => id === "depends-on")?.nodes[0].resource?.id).toBe("dependency");
  expect(sections.find(({ id }) => id === "sub-tickets")?.nodes.map((node) => node.resource?.id)).toEqual(["child"]);
  expect(
    sections
      .find(({ id }) => id === "required-by")
      ?.nodes.map((node) => node.resource?.id)
      .sort(),
  ).toEqual(["dependent", "legacy"]);
  expect(reads.filter((read) => read.startsWith("tickets/other-"))).toEqual([]);
});
