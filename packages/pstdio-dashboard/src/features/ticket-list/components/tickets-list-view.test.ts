import { describe, expect, it } from "bun:test";

import type { Ticket } from "@/features/ticket-list/types";

import type { BadgeContext, DisplayProperty, TicketGroup } from "../types";
import { buildGroupedListItems, buildListDragPermissionsFromGroups } from "./tickets-list-view";

const makeTicket = (overrides: Partial<Ticket>): Ticket => ({
  id: "ticket-1",
  shorthand: "PS-1",
  title: "Ticket",
  content: "",
  tagIds: [],
  status: "todo",
  statusColor: "gray",
  updatedAt: "2026-04-10T12:00:00.000Z",
  ...overrides,
});

const baseContext: BadgeContext = {
  statusOptions: [{ name: "todo", color: "gray" }],
  tags: [],
  tagMap: new Map(),
  ticketShorthandById: {},
};

describe("buildGroupedListItems", () => {
  it("builds grouped rows with nested ticket children for list view", () => {
    const groups: TicketGroup[] = [
      {
        id: "todo",
        label: "Todo",
        color: "gray",
        tickets: [makeTicket({ id: "ticket-1", shorthand: "PS-1" }), makeTicket({ id: "ticket-2", shorthand: "PS-2" })],
        canDragIn: true,
        canDragOut: true,
        canCreate: true,
        columnActions: [],
      },
    ];

    const items = buildGroupedListItems(groups, [] satisfies DisplayProperty[], baseContext, "Empty", () => undefined);

    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("group::todo");
    expect(items[0]?.title).toBe("Todo (2)");
    expect(items[0]?.children?.map((child) => child.id)).toEqual(["ticket-1", "ticket-2"]);
  });
});

describe("buildListDragPermissionsFromGroups", () => {
  it("maps canDragOut tickets to draggable ids", () => {
    const groups: TicketGroup[] = [
      {
        id: "todo",
        label: "Todo",
        color: "gray",
        tickets: [makeTicket({ id: "ticket-1" })],
        canDragIn: true,
        canDragOut: false,
        canCreate: true,
        columnActions: [],
      },
      {
        id: "in_progress",
        label: "In Progress",
        color: "blue",
        tickets: [makeTicket({ id: "ticket-2" })],
        canDragIn: true,
        canDragOut: true,
        canCreate: true,
        columnActions: [],
      },
    ];

    const permissions = buildListDragPermissionsFromGroups(groups);

    expect(permissions.draggableItemIds.has("ticket-1")).toBe(false);
    expect(permissions.draggableItemIds.has("ticket-2")).toBe(true);
  });

  it("keeps empty but droppable groups as drop targets", () => {
    const groups: TicketGroup[] = [
      {
        id: "done",
        label: "Done",
        color: "green",
        tickets: [],
        canDragIn: true,
        canDragOut: true,
        canCreate: true,
        columnActions: [],
      },
    ];

    const permissions = buildListDragPermissionsFromGroups(groups);

    expect(permissions.dropTargetGroupIds.has("group::done")).toBe(true);
  });
});
