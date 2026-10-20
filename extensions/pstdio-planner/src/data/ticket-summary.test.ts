import { ticketContext, ticketsCollection } from "./ticket-context.fixture";
import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";

import { createTicketParentLookup, createTicketWorkspaceLookup, ticketToRow } from "./mappers";
import { observeStorageReads } from "./storage-reads.fixture";
import { readTicketParentLookup } from "./ticket-resource-hierarchy";
import { ticketSummary } from "./ticket-summary";
import type { StoredTag, Ticket } from "./types";

const ticket = (id: string, parentId?: string): Ticket => ({
  id,
  shorthand: `T-${id}`,
  title: id,
  content: "Full ticket body",
  files: [{ id: "file", name: "notes.md", content: "File body", createdAt: "before", updatedAt: "after" }],
  userPrompt: "Implementation instructions",
  statusId: "ready",
  tagIds: ["feature", "urgent"],
  archived: false,
  sortOrder: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  parentId,
});

test("summary rows preserve full-ticket values, hierarchy, tags, archives and workspace badges", () => {
  const tickets = [
    ticket("root"),
    { ...ticket("child", "root"), archived: true },
    { ...ticket("orphan", "missing"), title: "", statusId: null, tagIds: undefined },
    ticket("cycle-a", "cycle-b"),
    ticket("cycle-b", "cycle-a"),
  ];
  const tags: StoredTag[] = [
    {
      id: "labels",
      name: "Labels",
      type: "multi_select",
      sortOrder: 0,
      options: ["feature", "urgent"].map((id) => ({
        id,
        name: id,
        color: "blue",
        icon: null,
        description: null,
        sortOrder: 0,
      })),
    },
  ];
  const workspaces = createTicketWorkspaceLookup([
    { id: "workspace", name: "Working copy", anchors_json: [{ type: "ticket", id: "child", shorthand: "T-child" }] },
  ]);
  const fullLookup = createTicketParentLookup(tickets);
  const summaries = tickets.map(ticketSummary);
  const summaryLookup = createTicketParentLookup(summaries);

  expect(summaries.map((summary) => ticketToRow(summary, "project", tags, workspaces, summaryLookup))).toEqual(
    tickets.map((full) => ticketToRow(full, "project", tags, workspaces, fullLookup)),
  );
});

test("selected hierarchy retains summaries without retaining bodies or rereading selected records", async () => {
  const storage = createMemoryStorage();
  const parent = ticket("parent");
  const child = ticket("child", parent.id);
  await ticketsCollection(storage).put(parent.id, parent);
  await ticketsCollection(storage).put("unrelated", ticket("unrelated"));
  const observed = observeStorageReads(storage);

  const lookup = await readTicketParentLookup(
    { ...ticketContext(storage), storage: observed.storage },
    new Map([[child.id, child]]),
  );

  expect(observed.reads).toEqual(["tickets/parent"]);
  expect([...lookup.keys()]).toEqual(["child", "parent"]);
  for (const summary of lookup.values()) {
    expect(summary).not.toHaveProperty("content");
    expect(summary).not.toHaveProperty("files");
    expect(summary).not.toHaveProperty("userPrompt");
  }
  expect(child.files?.[0].content).toBe("File body");
  expect(await ticketsCollection(storage).get(parent.id)).toEqual(parent);
});
