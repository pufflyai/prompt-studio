import { describe, expect, test } from "bun:test";
import { buildTicketAttributes, statusToColumnConfig, TICKET_RESOURCE_KIND, ticketToRow } from "./mappers";
import type { StoredStatus, StoredTicket } from "./types";

const ticket: StoredTicket = {
  id: "t1",
  shorthand: "T-1",
  title: "Fix the thing",
  content: "body",
  statusId: "s-todo",
  archived: false,
  sortOrder: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

const status: StoredStatus = {
  id: "s-todo",
  name: "Todo",
  color: "blue",
  sortOrder: 1,
  isDefault: true,
  canCreate: true,
  canDragIn: true,
  canDragOut: false,
  columnActions: ["archive_all"],
};

describe("ticketToRow", () => {
  test("maps a ticket to a data-renderer row with a ticket resource", () => {
    const row = ticketToRow(ticket, "proj-1");

    expect(row.id).toBe("t1");
    expect(row.title).toBe("T-1 Fix the thing");
    expect(row.resource).toEqual({
      type: TICKET_RESOURCE_KIND,
      id: "t1",
      projectId: "proj-1",
      label: "T-1 Fix the thing",
    });
    expect(row.attributes).toEqual({ status: "s-todo", updated: "2026-01-02T00:00:00.000Z", shorthand: "T-1" });
  });

  test("falls back to the shorthand when there is no title", () => {
    const row = ticketToRow({ ...ticket, title: "" }, "proj-1");
    expect(row.title).toBe("T-1");
  });
});

describe("buildTicketAttributes", () => {
  test("builds a status enum from sorted statuses", () => {
    const attributes = buildTicketAttributes([{ ...status, id: "s-done", name: "Done", sortOrder: 4 }, status]);

    const statusAttr = attributes.find((attribute) => attribute.id === "status");
    expect(statusAttr?.type).toEqual({
      kind: "enum",
      options: [
        { value: "s-todo", label: "Todo", color: "blue" },
        { value: "s-done", label: "Done", color: "blue" },
      ],
    });
    expect(statusAttr?.groupable).toBe(true);
  });

  test("uses name as the status sort tiebreak", () => {
    const attributes = buildTicketAttributes([
      { ...status, id: "s-z", name: "Zeta", sortOrder: 1 },
      { ...status, id: "s-a", name: "Alpha", sortOrder: 1 },
    ]);

    const statusAttr = attributes.find((attribute) => attribute.id === "status");
    expect(statusAttr?.type).toEqual({
      kind: "enum",
      options: [
        { value: "s-a", label: "Alpha", color: "blue" },
        { value: "s-z", label: "Zeta", color: "blue" },
      ],
    });
  });
});

describe("statusToColumnConfig", () => {
  test("maps drag/create rules and column actions", () => {
    expect(statusToColumnConfig(status)).toEqual({
      color: "blue",
      canDragIn: true,
      canDragOut: false,
      canCreate: true,
      actions: [{ id: "archive_all", label: "Archive all" }],
    });
  });
});
