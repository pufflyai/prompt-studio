import { describe, expect, it } from "bun:test";

import {
  buildDisplayPropertyOptions,
  buildFilterCategories,
  buildGroupingOptions,
  buildOrderingOptions,
  getEnumOptions,
  renderAttributeBadge,
  resolveKnownColumnKeys,
  resolveListDropTargetColumnKey,
  resolveSubGroupingOptions,
  sanitizeFilters,
  sanitizeSettings,
} from "./data-renderer-helpers";
import type { AttributeDescriptor, DataRendererRow } from "./types";
import { MANUAL_ORDERING, NO_GROUPING } from "./types";

const attributes: AttributeDescriptor[] = [
  {
    id: "status",
    label: "Status",
    type: {
      kind: "enum",
      options: [
        { value: "todo", label: "Todo", color: "gray" },
        { value: "done", label: "Done", color: "green" },
      ],
    },
    filterable: true,
    groupable: true,
    displayable: true,
  },
  {
    id: "owner",
    label: "Owner",
    type: { kind: "user" },
    filterable: true,
    displayable: true,
  },
  {
    id: "labels",
    label: "Labels",
    type: {
      kind: "enum-multi",
      options: [
        { value: "bug", label: "Bug" },
        { value: "p1", label: "P1" },
      ],
    },
    filterable: true,
    displayable: true,
  },
  {
    id: "updated",
    label: "Updated",
    type: { kind: "date" },
    sortable: true,
    displayable: true,
  },
];

describe("buildGroupingOptions", () => {
  it("starts with 'none' and lists groupable attributes excluding enum-multi", () => {
    const options = buildGroupingOptions(attributes);
    expect(options.map((option) => option.value)).toEqual(["none", "status"]);
  });
});

describe("buildOrderingOptions", () => {
  it("starts with manual + title and lists sortable attributes", () => {
    const options = buildOrderingOptions(attributes);
    expect(options.map((option) => option.value)).toEqual(["manual", "title", "updated"]);
  });
});

describe("buildDisplayPropertyOptions", () => {
  it("lists displayable attributes only", () => {
    const options = buildDisplayPropertyOptions(attributes);
    expect(options.map((option) => option.value)).toEqual(["status", "owner", "labels", "updated"]);
  });
});

describe("resolveKnownColumnKeys", () => {
  it("returns enum option values for enum-typed grouping", () => {
    const result = resolveKnownColumnKeys("status", attributes);
    expect(result).toEqual(["todo", "done"]);
  });

  it("returns active filter values when present", () => {
    const result = resolveKnownColumnKeys("status", attributes, { status: ["done"] });
    expect(result).toEqual(["done"]);
  });

  it("returns all active enum filter values for grouped columns", () => {
    const result = resolveKnownColumnKeys("status", attributes, { status: ["todo", "done"] });
    expect(result).toEqual(["todo", "done"]);
  });

  it("returns undefined when grouping is none", () => {
    expect(resolveKnownColumnKeys(NO_GROUPING, attributes)).toBeUndefined();
  });
});

describe("resolveSubGroupingOptions", () => {
  it("limits sub-grouping to 'none' when primary grouping is 'none'", () => {
    const options = buildGroupingOptions(attributes);
    const result = resolveSubGroupingOptions(options, NO_GROUPING);
    expect(result.map((option) => option.value)).toEqual(["none"]);
  });

  it("excludes the primary grouping option", () => {
    const options = buildGroupingOptions(attributes);
    const result = resolveSubGroupingOptions(options, "status");
    expect(result.map((option) => option.value)).toEqual(["none"]);
  });
});

describe("resolveListDropTargetColumnKey", () => {
  it("returns 'all' for ungrouped lists", () => {
    expect(resolveListDropTargetColumnKey(NO_GROUPING)).toBe("all");
  });

  it("uses placement column for grouped lists", () => {
    expect(resolveListDropTargetColumnKey("status", { columnKey: "todo" })).toBe("todo");
  });
});

describe("buildFilterCategories", () => {
  const rows: DataRendererRow[] = [
    { id: "1", title: "A", attributes: { status: "todo", owner: "Alice", labels: ["bug"] } },
    { id: "2", title: "B", attributes: { status: "done", owner: "Bob", labels: ["p1"] } },
  ];

  it("emits enum options first and merges in undeclared row values", () => {
    const rowsWithExtras: DataRendererRow[] = [...rows, { id: "3", title: "C", attributes: { status: "blocked" } }];

    const categories = buildFilterCategories(attributes, rowsWithExtras);
    const status = categories.find((category) => category.id === "status");

    expect(status?.options.map((option) => option.value)).toEqual(["todo", "done", "blocked"]);
  });

  it("marks enum filter categories as multi-select", () => {
    const categories = buildFilterCategories(attributes, rows);

    expect(categories.find((category) => category.id === "status")?.selectionMode).toBe("multiple");
    expect(categories.find((category) => category.id === "labels")?.selectionMode).toBe("multiple");
  });

  it("auto-derives options for non-enum filterable attributes", () => {
    const categories = buildFilterCategories(attributes, rows);
    const owner = categories.find((category) => category.id === "owner");

    expect(owner?.options.map((option) => option.value)).toEqual(["Alice", "Bob"]);
  });

  it("resolves source-backed enum options when building filter categories", () => {
    const sourcedAttributes: AttributeDescriptor[] = [
      {
        id: "status",
        label: "Status",
        type: {
          kind: "enum",
          options: {
            subscribe: () => () => {},
            getSnapshot: () => [
              { value: "running", label: "Running", color: "blue" },
              { value: "merged", label: "Merged", color: "green" },
            ],
          },
        },
        filterable: true,
      },
    ];

    const categories = buildFilterCategories(sourcedAttributes, []);
    const status = categories.find((category) => category.id === "status");
    expect(status?.options.map((option) => option.value)).toEqual(["running", "merged"]);
  });
});

describe("sanitizeFilters", () => {
  it("preserves selected enum filter values", () => {
    expect(sanitizeFilters({ status: ["todo", "done"], labels: ["bug", "p1"] }, attributes)).toEqual({
      status: ["todo", "done"],
      labels: ["bug", "p1"],
    });
  });
});

describe("getEnumOptions", () => {
  it("deduplicates enum options by value", () => {
    const options = getEnumOptions({
      kind: "enum-multi",
      options: [
        { value: "bug", label: "Bug", color: "red" },
        { value: "bug", label: "Bug duplicate", color: "orange" },
        { value: "feature", label: "Feature", color: "green" },
      ],
    });

    expect(options).toEqual([
      { value: "bug", label: "Bug", color: "red" },
      { value: "feature", label: "Feature", color: "green" },
    ]);
  });
});

describe("renderAttributeBadge", () => {
  it("formats an enum value with its declared label and color", () => {
    const descriptor = attributes.find((attribute) => attribute.id === "status")!;
    const row: DataRendererRow = { id: "1", title: "A", attributes: { status: "todo" } };

    expect(renderAttributeBadge(descriptor, row)).toEqual({
      attributeId: "status",
      attributeLabel: "Status",
      label: "Todo",
      color: "gray",
      icon: undefined,
    });
  });

  it("summarizes an enum-multi value", () => {
    const descriptor = attributes.find((attribute) => attribute.id === "labels")!;
    const row: DataRendererRow = { id: "1", title: "A", attributes: { labels: ["bug", "p1"] } };

    const badge = renderAttributeBadge(descriptor, row);

    expect(badge?.label).toBe("Bug, P1");
  });

  it("includes editable dropdown metadata for editable enum-multi values", () => {
    const descriptor: AttributeDescriptor = {
      ...attributes.find((attribute) => attribute.id === "labels")!,
      editable: true,
    };
    const row: DataRendererRow = { id: "1", title: "A", attributes: { labels: ["bug"] } };

    const badge = renderAttributeBadge(descriptor, row);

    expect(badge).toMatchObject({
      attributeId: "labels",
      attributeLabel: "Labels",
      label: "Bug",
      value: ["bug"],
      options: [
        { value: "bug", label: "Bug" },
        { value: "p1", label: "P1" },
      ],
      isEditable: true,
    });
  });

  it("keeps editable enum badges renderable when the value is missing", () => {
    const descriptor: AttributeDescriptor = {
      ...attributes.find((attribute) => attribute.id === "status")!,
      editable: true,
    };
    const row: DataRendererRow = { id: "1", title: "A", attributes: {} };

    expect(renderAttributeBadge(descriptor, row)).toEqual({
      attributeId: "status",
      attributeLabel: "Status",
      label: "Status",
      value: undefined,
      options: [
        { value: "todo", label: "Todo", color: "gray" },
        { value: "done", label: "Done", color: "green" },
      ],
      isEditable: true,
    });
  });

  it("keeps editable enum-multi badges renderable when no values are selected", () => {
    const descriptor: AttributeDescriptor = {
      ...attributes.find((attribute) => attribute.id === "labels")!,
      editable: true,
    };
    const row: DataRendererRow = { id: "1", title: "A", attributes: { labels: [] } };

    expect(renderAttributeBadge(descriptor, row)).toEqual({
      attributeId: "labels",
      attributeLabel: "Labels",
      label: "Labels",
      value: [],
      options: [
        { value: "bug", label: "Bug" },
        { value: "p1", label: "P1" },
      ],
      isEditable: true,
    });
  });

  it("returns null when the value is missing", () => {
    const descriptor = attributes.find((attribute) => attribute.id === "status")!;
    const row: DataRendererRow = { id: "1", title: "A", attributes: {} };

    expect(renderAttributeBadge(descriptor, row)).toBeNull();
  });
});

describe("sanitizeSettings", () => {
  it("drops unknown grouping / ordering / displayProperty ids", () => {
    const sanitized = sanitizeSettings(
      {
        viewMode: "board",
        columnGrouping: "ghost",
        rowGrouping: "status",
        ordering: { attributeId: "alsoGhost", direction: "asc" },
        displayProperties: ["status", "ghost"],
      },
      attributes,
    );

    expect(sanitized.columnGrouping).toBe(NO_GROUPING);
    expect(sanitized.rowGrouping).toBe("status");
    expect(sanitized.ordering.attributeId).toBe(MANUAL_ORDERING);
    expect(sanitized.displayProperties).toEqual(["status"]);
  });
});

describe("sanitizeFilters", () => {
  it("drops unknown attribute ids and empty value lists", () => {
    const sanitized = sanitizeFilters({ status: ["todo"], ghost: ["x"], owner: [] }, attributes);

    expect(sanitized).toEqual({ status: ["todo"] });
  });
});
