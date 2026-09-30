import { describe, expect, test } from "bun:test";
import { buildTicketAttributes, statusToColumnConfig } from "./mappers";
import type { StoredStatus } from "./types";

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

describe("buildTicketAttributes", () => {
  test("exposes archive state as a filter-only enum", () => {
    const archiveAttribute = buildTicketAttributes([]).find((attribute) => attribute.id === "archived");

    expect(archiveAttribute).toEqual({
      id: "archived",
      label: { $l10n: "displayMenu.propertyOptions.archived", default: "Archived" },
      type: {
        kind: "enum",
        options: [
          { value: "active", label: { $l10n: "archiveState.active", default: "Active" } },
          { value: "archived", label: { $l10n: "archiveState.archived", default: "Archived" } },
        ],
      },
      filterable: true,
      editable: false,
    });
  });

  test("builds a status enum from sorted statuses", () => {
    const attributes = buildTicketAttributes([
      { ...status, id: "s-done", name: "Done", icon: "check-circle", sortOrder: 4 },
      { ...status, icon: "flag" },
    ]);

    const statusAttr = attributes.find((attribute) => attribute.id === "status");
    expect(statusAttr?.type).toEqual({
      kind: "enum",
      options: [
        { value: "s-todo", label: "Todo", color: "blue", icon: "flag" },
        { value: "s-done", label: "Done", color: "blue", icon: "check-circle" },
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

  test("exposes parent as a filter-only string attribute", () => {
    const parentAttribute = buildTicketAttributes([]).find((attribute) => attribute.id === "parent");

    expect(parentAttribute).toEqual({
      id: "parent",
      label: { $l10n: "displayMenu.propertyOptions.parent", default: "Parent" },
      type: { kind: "string" },
      filterable: true,
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

  test("preserves the configured default complexity option icons", () => {
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
        { value: "default-complexity-simple", label: "Simple", color: "green", icon: "feather" },
        { value: "default-complexity-complex", label: "Complex", color: "red", icon: "layers" },
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
