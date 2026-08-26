import { describe, expect, test } from "bun:test";
import {
  linkedResourceParentMetadata,
  resolveTicketHierarchy,
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
  test("resolves root-first lineage, breadcrumb, and immediate parent from one traversal", () => {
    const root = storedTicket({ id: "root", shorthand: "PS-1", title: "Root" });
    const parent = storedTicket({ id: "parent", shorthand: "PS-2", parentId: root.id });
    const child = storedTicket({ id: "child", shorthand: "PS-3", parentId: parent.id });
    const tickets = new Map([
      [root.id, root],
      [parent.id, parent],
      [child.id, child],
    ]);

    const hierarchy = resolveTicketHierarchy(child, tickets);

    expect(hierarchy.lineage.map((ticket) => ticket.id)).toEqual(["root", "parent", "child"]);
    expect(hierarchy.breadcrumb).toBe("PS-1 / PS-2 / PS-3");
    expect(hierarchy.parent).toBe(parent);
  });

  test("stops lineage at missing parents and repeated tickets", () => {
    const missingParent = storedTicket({ id: "orphan", shorthand: "PS-3", parentId: "missing" });
    const child = storedTicket({ id: "child", shorthand: "PS-2", parentId: "parent" });
    const parent = storedTicket({ id: "parent", shorthand: "PS-1", parentId: "child" });
    const tickets = new Map([
      [parent.id, parent],
      [child.id, child],
    ]);

    expect(resolveTicketHierarchy(missingParent, tickets).breadcrumb).toBe("PS-3");
    expect(resolveTicketHierarchy(missingParent, tickets).parent).toBeUndefined();
    expect(resolveTicketHierarchy(child, tickets).lineage.map((ticket) => ticket.id)).toEqual(["parent", "child"]);
    expect(resolveTicketHierarchy(child, tickets).breadcrumb).toBe("PS-1 / PS-2");
  });

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
            metadata: {
              shorthand: "PS-1",
              resourceParent: { type: "view", viewId: "pstdio.pstdio-planner.view.tickets" },
            },
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
          metadata: {
            shorthand: "PS-1",
            resourceParent: { type: "view", viewId: "pstdio.pstdio-planner.view.tickets" },
          },
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
        metadata: {
          shorthand: "PS-2",
          resourceParent: { type: "view", viewId: "pstdio.pstdio-planner.view.tickets" },
        },
      },
    });
  });
});

describe("tickets browse root", () => {
  test("the lineage root names the Tickets view as its parent", () => {
    const root = storedTicket({ id: "root", shorthand: "PS-1" });
    const child = storedTicket({ id: "child", shorthand: "PS-2", parentId: root.id });
    const tickets = new Map([
      [root.id, root],
      [child.id, child],
    ]);

    const reference = ticketResourceReference(child, tickets);
    const rootReference = reference.metadata.resourceParent as { metadata: Record<string, unknown> };

    expect(rootReference.metadata.resourceParent).toEqual({
      type: "view",
      viewId: "pstdio.pstdio-planner.view.tickets",
    });
  });

  test("a top-level ticket names the Tickets view as its parent", () => {
    const ticket = storedTicket({ id: "solo", shorthand: "PS-9" });

    expect(ticketResourceReference(ticket).metadata.resourceParent).toEqual({
      type: "view",
      viewId: "pstdio.pstdio-planner.view.tickets",
    });
  });
});
