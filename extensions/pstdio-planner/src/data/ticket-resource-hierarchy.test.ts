import { describe, expect, test } from "bun:test";
import {
  linkedResourceParentMetadata,
  ticketResourceHierarchyMetadata,
  ticketResourceReference,
} from "./ticket-resource-hierarchy";
import type { StoredTicket } from "./types";

const storedTicket = (overrides: Partial<StoredTicket>): StoredTicket => ({
  id: "ticket-1",
  shorthand: "PS-1",
  title: "Ticket",
  content: "",
  statusId: null,
  archived: false,
  sortOrder: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("ticket resource hierarchy", () => {
  test("serializes a three-level chain as canonical parent resource edges", () => {
    const root = storedTicket({ id: "root", shorthand: "PS-1", title: "Root" });
    const parent = storedTicket({
      id: "parent",
      shorthand: "PS-2",
      title: "Parent",
      parentId: root.id,
    });
    const child = storedTicket({
      id: "child",
      shorthand: "PS-3",
      title: "Child",
      parentId: parent.id,
    });
    const tickets = new Map([
      [root.id, root],
      [parent.id, parent],
      [child.id, child],
    ]);

    expect(ticketResourceHierarchyMetadata(child, tickets)).toEqual({
      shorthand: "PS-3",
      resourceParent: {
        type: "ticket",
        id: "parent",
        label: "PS-2 Parent",
        metadata: {
          shorthand: "PS-2",
          resourceParent: {
            type: "ticket",
            id: "root",
            label: "PS-1 Root",
            metadata: { shorthand: "PS-1" },
          },
        },
      },
    });
  });

  test("stops serializing parent edges when the ticket graph cycles", () => {
    const child = storedTicket({ id: "child", shorthand: "PS-2", parentId: "parent" });
    const parent = storedTicket({ id: "parent", shorthand: "PS-1", parentId: "child" });
    const tickets = new Map([
      [parent.id, parent],
      [child.id, child],
    ]);

    expect(ticketResourceReference(child, tickets)).toEqual({
      type: "ticket",
      id: "child",
      label: "PS-2 Ticket",
      metadata: {
        shorthand: "PS-2",
        resourceParent: {
          type: "ticket",
          id: "parent",
          label: "PS-1 Ticket",
          metadata: { shorthand: "PS-1" },
        },
      },
    });
  });

  test("links a workspace to the selected ticket resource", () => {
    const ticket = storedTicket({ id: "child", shorthand: "PS-2", title: "Child" });

    const metadata = linkedResourceParentMetadata(ticket, new Map([[ticket.id, ticket]]));

    expect(metadata).toEqual({
      resourceParent: {
        type: "ticket",
        id: "child",
        label: "PS-2 Child",
        metadata: { shorthand: "PS-2" },
      },
    });
  });
});
