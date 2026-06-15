import { describe, expect, test } from "bun:test";
import {
  buildTicketAttributes,
  createTicketParentLookup,
  statusToColumnConfig,
  TICKET_RESOURCE_KIND,
  ticketToRow,
} from "./mappers";
import type { StoredStatus, StoredTag, StoredTicket } from "./types";

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
    // Card title drops the shorthand prefix; the breadcrumb keeps it via resource.label.
    expect(row.title).toBe("Fix the thing");
    expect(row.resource).toEqual({
      type: TICKET_RESOURCE_KIND,
      id: "t1",
      projectId: "proj-1",
      label: "T-1 Fix the thing",
      icon: "component",
    });
    expect(row.attributes).toEqual({
      status: "s-todo",
      created: "2026-01-01T00:00:00.000Z",
      updated: "2026-01-02T00:00:00.000Z",
      id: "T-1",
      workspace: "",
      workspaceItems: [],
    });
  });

  test("falls back to the shorthand when there is no title", () => {
    const row = ticketToRow({ ...ticket, title: "" }, "proj-1");
    expect(row.title).toBe("T-1");
  });

  test("adds parent ticket metadata to child ticket resources", () => {
    const child = { ...ticket, id: "t2", shorthand: "T-2", title: "Child", parentId: ticket.id };
    const row = ticketToRow(child, "proj-1", [], new Map(), createTicketParentLookup([ticket, child]));

    expect(row.resource.metadata).toEqual({
      parentTicketId: "t1",
      parentTicketLabel: "T-1 Fix the thing",
      parentTicketShorthand: "T-1",
    });
  });

  test("maps legacy default type selections as a single scalar value", () => {
    const typeTag: StoredTag = {
      id: "default-type",
      name: "Type",
      type: "multi_select",
      sortOrder: 0,
      options: [
        { id: "default-type-bug", name: "Bug", color: "red", icon: "bug", description: null, sortOrder: 0 },
        {
          id: "default-type-feature",
          name: "Feature",
          color: "green",
          icon: "sparkles",
          description: null,
          sortOrder: 1,
        },
      ],
    };

    const row = ticketToRow({ ...ticket, tagIds: ["default-type-bug", "default-type-feature"] }, "proj-1", [typeTag]);

    expect((row.attributes as Record<string, unknown>).type).toBe("default-type-bug");
  });
});

describe("buildTicketAttributes", () => {
  test("builds a status enum from sorted statuses", () => {
    const attributes = buildTicketAttributes([
      { ...status, id: "s-done", name: "Done", icon: "check-circle", sortOrder: 4 },
      { ...status, icon: "flag" },
    ]);

    const statusAttr = attributes.find((attribute) => attribute.id === "status");
    expect(statusAttr?.type).toEqual({
      kind: "enum",
      options: [
        { value: "s-todo", label: "Todo", color: "blue", icon: "circle" },
        { value: "s-done", label: "Done", color: "blue", icon: "circle" },
      ],
    });
    expect(statusAttr?.groupable).toBe(true);
  });

  test("exposes created and updated date attributes for sorting", () => {
    const attributes = buildTicketAttributes([]);

    expect(attributes.find((attribute) => attribute.id === "created")).toMatchObject({
      label: { $l10n: "displayMenu.propertyOptions.createdAt", default: "Created" },
      type: { kind: "date" },
      sortable: true,
      displayable: true,
    });
    expect(attributes.find((attribute) => attribute.id === "updated")).toMatchObject({
      label: { $l10n: "displayMenu.propertyOptions.updatedAt", default: "Updated" },
      type: { kind: "date" },
      sortable: true,
      displayable: true,
    });
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
        { value: "s-a", label: "Alpha", color: "blue", icon: "circle" },
        { value: "s-z", label: "Zeta", color: "blue", icon: "circle" },
      ],
    });
  });

  test("renders the default complexity tag with circle option icons", () => {
    const attributes = buildTicketAttributes(
      [],
      [
        {
          id: "default-complexity",
          name: "Complexity",
          type: "single_select",
          sortOrder: 0,
          options: [
            {
              id: "default-complexity-simple",
              name: "Simple",
              color: "green",
              icon: "feather",
              description: null,
              sortOrder: 0,
            },
            {
              id: "default-complexity-complex",
              name: "Complex",
              color: "red",
              icon: "layers",
              description: null,
              sortOrder: 1,
            },
          ],
        },
      ],
    );

    const complexityAttribute = attributes.find((attribute) => attribute.id === "complexity");

    expect(complexityAttribute?.type).toEqual({
      kind: "enum",
      options: [
        { value: "default-complexity-simple", label: "Simple", color: "green", icon: "circle" },
        { value: "default-complexity-complex", label: "Complex", color: "red", icon: "circle" },
      ],
    });
  });

  test("treats the default type tag as a scalar enum even when stored as multi-select", () => {
    const attributes = buildTicketAttributes(
      [],
      [
        {
          id: "default-type",
          name: "Type",
          type: "multi_select",
          sortOrder: 0,
          options: [
            { id: "default-type-bug", name: "Bug", color: "red", icon: "bug", description: null, sortOrder: 0 },
          ],
        },
      ],
    );

    const typeAttribute = attributes.find((attribute) => attribute.id === "type");

    expect(typeAttribute?.type.kind).toBe("enum");
    expect(typeAttribute?.groupable).toBe(true);
    expect(typeAttribute?.editable).toBe(true);
  });
});

describe("statusToColumnConfig", () => {
  test("maps drag/create rules and column actions", () => {
    expect(statusToColumnConfig(status)).toEqual({
      color: "blue",
      canDragIn: true,
      canDragOut: false,
      canCreate: true,
      actions: [
        { id: "archive_all", label: { $l10n: "boardView.archiveAll", default: "Archive all" }, icon: "archive" },
      ],
    });
  });
});
