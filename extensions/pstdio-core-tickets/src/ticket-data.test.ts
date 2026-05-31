import { describe, expect, test } from "bun:test";
import {
  createTicketAttributes,
  createTicketRows,
  resolveTicketBoardColumnConfig,
  ticketDefaultSettings,
} from "./ticket-data";

const statuses = [
  {
    id: "status-backlog",
    name: "backlog",
    color: "gray",
    sortOrder: 10,
    isDefault: true,
    canCreate: true,
    canDragIn: true,
    canDragOut: true,
    columnActions: [],
  },
  {
    id: "status-done",
    name: "done",
    color: "green",
    sortOrder: 20,
    isDefault: false,
    canCreate: false,
    canDragIn: true,
    canDragOut: false,
    columnActions: ["archive_all"],
  },
];

describe("ticket data renderer model", () => {
  test("uses ticket statuses as the board column schema", () => {
    const [statusAttribute] = createTicketAttributes(statuses);

    expect(statusAttribute).toMatchObject({
      id: "status",
      label: "Status",
      filterable: true,
      groupable: true,
      sortable: true,
      displayable: true,
      editable: true,
      type: {
        kind: "enum",
        options: [
          { value: "backlog", label: "backlog", color: "gray" },
          { value: "done", label: "done", color: "green" },
        ],
      },
    });
  });

  test("maps tickets to data renderer rows with dashboard-compatible resource metadata", () => {
    const rows = createTicketRows([
      {
        id: "ticket-1",
        shorthand: "PS-304",
        display_title: "Move tickets",
        status_name: "backlog",
        tag_ids: ["tag-1"],
        tag_names: ["ui"],
        updated_at: "2026-05-27T10:00:00.000Z",
      },
    ]);

    expect(rows).toEqual([
      {
        id: "ticket-1",
        title: "PS-304 Move tickets",
        resource: {
          type: "ticket",
          id: "ticket-1",
          label: "PS-304",
          metadata: { shorthand: "PS-304", title: "Move tickets" },
        },
        attributes: {
          shorthand: "PS-304",
          status: "backlog",
          tags: ["ui"],
          updated: "2026-05-27T10:00:00.000Z",
        },
      },
    ]);
  });

  test("resolves status controls for data renderer board columns", () => {
    expect(resolveTicketBoardColumnConfig(statuses, "done")).toEqual({
      color: "green",
      canCreate: false,
      canDragIn: true,
      canDragOut: false,
      actionIds: ["archive_all"],
    });
  });

  test("defaults to the same board setup as the dashboard", () => {
    expect(ticketDefaultSettings).toEqual({
      viewMode: "board",
      columnGrouping: "status",
      rowGrouping: "none",
      ordering: { attributeId: "updated", direction: "desc" },
      displayProperties: ["shorthand", "tags", "updated"],
    });
  });
});
