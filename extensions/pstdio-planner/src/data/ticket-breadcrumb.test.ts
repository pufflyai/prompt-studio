import { describe, expect, test } from "bun:test";
import { buildTicketBreadcrumbItems } from "./ticket-breadcrumb";
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

describe("buildTicketBreadcrumbItems", () => {
  test("stops when the parent chain cycles", () => {
    const child = storedTicket({
      id: "child",
      shorthand: "PS-2",
      title: "Child",
      parentId: "parent",
    });
    const parent = storedTicket({
      id: "parent",
      shorthand: "PS-1",
      title: "Parent",
      parentId: "child",
    });

    const items = buildTicketBreadcrumbItems(
      child,
      new Map([
        ["parent", parent],
        ["child", child],
      ]),
    );

    expect(items.map((item) => item.id)).toEqual(["parent", "child"]);
  });
});
