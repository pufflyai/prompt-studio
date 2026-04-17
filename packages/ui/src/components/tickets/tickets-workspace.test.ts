import { describe, expect, it } from "bun:test";

import type { TicketColumnGroup } from "./ticket-grouping";
import { buildListDragPermissions } from "./tickets-workspace";

const grouped: TicketColumnGroup[] = [
  {
    key: "todo",
    label: "todo",
    tickets: [{ id: "ticket-1", ticketId: "PS-1", title: "One" }],
    rows: [],
  },
  {
    key: "done",
    label: "done",
    tickets: [],
    rows: [],
  },
];

describe("buildListDragPermissions", () => {
  it("keeps empty columns as valid drop targets when canDragIn is enabled", () => {
    const permissions = buildListDragPermissions(grouped, (column) => ({
      canDragIn: column === "done",
      canDragOut: column === "todo",
    }));

    expect(permissions.dropTargetGroupIds.has("group::done")).toBe(true);
    expect(permissions.draggableItemIds.has("ticket-1")).toBe(true);
  });

  it("does not mark tickets as draggable when source column cannot drag out", () => {
    const permissions = buildListDragPermissions(grouped, () => ({ canDragIn: true, canDragOut: false }));

    expect(permissions.draggableItemIds.size).toBe(0);
    expect(permissions.dropTargetGroupIds.has("group::todo")).toBe(true);
    expect(permissions.dropTargetGroupIds.has("group::done")).toBe(true);
  });
});
