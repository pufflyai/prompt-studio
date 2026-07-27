import { describe, expect, it } from "bun:test";

import { countFilterValues, filterRows, groupRows, orderRows } from "./kanban-renderer-grouping";
import type { AttributeDescriptor, KanbanRendererRow } from "./types";
import { MANUAL_ORDERING } from "./types";

const attributes: AttributeDescriptor[] = [
  {
    id: "status",
    label: "Status",
    type: {
      kind: "enum",
      options: [
        { value: "todo", label: "Todo" },
        { value: "in_progress", label: "In progress" },
        { value: "done", label: "Done" },
      ],
    },
    filterable: true,
    groupable: true,
    sortable: true,
    displayable: true,
  },
  {
    id: "assignee",
    label: "Assignee",
    type: { kind: "user" },
    filterable: true,
    groupable: true,
  },
  {
    id: "component",
    label: "Component",
    type: {
      kind: "enum",
      options: [
        { value: "backend", label: "Backend" },
        { value: "frontend", label: "Frontend" },
      ],
    },
    filterable: true,
    groupable: true,
    sortable: true,
  },
  {
    id: "priority",
    label: "Priority",
    type: {
      kind: "enum",
      options: [
        { value: "high", label: "High" },
        { value: "medium", label: "Medium" },
        { value: "low", label: "Low" },
      ],
    },
    sortable: true,
  },
  {
    id: "updated",
    label: "Updated",
    type: { kind: "date" },
    sortable: true,
  },
  {
    id: "labels",
    label: "Labels",
    type: {
      kind: "enum-multi",
      options: [
        { value: "bug", label: "Bug" },
        { value: "regression", label: "Regression" },
      ],
    },
    filterable: true,
  },
];

const rows: KanbanRendererRow[] = [
  {
    id: "1",
    title: "Alpha",
    attributes: { status: "todo", assignee: "Alice", component: "frontend", updated: "2026-03-10T00:00:00.000Z" },
  },
  {
    id: "2",
    title: "Beta",
    attributes: {
      status: "in_progress",
      assignee: "Bob",
      component: "backend",
      priority: "high",
      updated: "2026-03-11T00:00:00.000Z",
      labels: ["bug", "regression"],
    },
  },
  {
    id: "3",
    title: "Gamma",
    attributes: { status: "todo", updated: "2026-03-12T00:00:00.000Z" },
  },
];

describe("groupRows", () => {
  it("groups by enum attribute in the declared option order", () => {
    const groups = groupRows(rows, { attributes, columnGrouping: "status", rowGrouping: "none" });

    expect(groups.length).toBe(2);
    expect(groups.map((group) => group.key)).toEqual(["todo", "in_progress"]);
  });

  it("groups by primary and secondary attribute", () => {
    const groups = groupRows(rows, { attributes, columnGrouping: "status", rowGrouping: "assignee" });

    expect(groups[0]?.key).toBe("todo");
    expect(groups[0]?.subgroups.length).toBe(2);
    expect(groups[0]?.subgroups[0]?.key).toBe("Alice");
  });

  it("preserves empty columns for known keys in declared order", () => {
    const groups = groupRows(rows, {
      attributes,
      columnGrouping: "status",
      rowGrouping: "none",
      knownColumnKeys: ["todo", "in_progress", "done"],
    });

    expect(groups.length).toBe(3);
    expect(groups.map((group) => group.key)).toEqual(["todo", "in_progress", "done"]);
    expect(groups[2]?.rows.length).toBe(0);
  });

  it("groups by another enum attribute", () => {
    const groups = groupRows(rows, { attributes, columnGrouping: "component", rowGrouping: "none" });

    expect(groups.map((group) => group.key)).toEqual(["backend", "frontend", "No component"]);
  });

  it("collects rows whose enum value was removed into the unassigned column", () => {
    const orphanedRows: KanbanRendererRow[] = [
      { id: "1", title: "Alpha", attributes: { status: "todo" } },
      { id: "2", title: "Beta", attributes: { status: "archived" } },
    ];

    const groups = groupRows(orphanedRows, { attributes, columnGrouping: "status", rowGrouping: "none" });

    expect(groups.map((group) => group.key)).toEqual(["todo", "No status"]);
    expect(groups.find((group) => group.key === "No status")?.rows.map((row) => row.id)).toEqual(["2"]);
  });

  it("orders enum columns by declared option index even when row data is alphabetical", () => {
    const orderedAttributes: AttributeDescriptor[] = [
      {
        id: "stage",
        label: "Stage",
        type: {
          kind: "enum",
          options: [
            { value: "shipped", label: "Shipped" },
            { value: "backlog", label: "Backlog" },
            { value: "active", label: "Active" },
          ],
        },
        groupable: true,
      },
    ];
    const stageRows: KanbanRendererRow[] = [
      { id: "1", title: "A", attributes: { stage: "backlog" } },
      { id: "2", title: "B", attributes: { stage: "shipped" } },
      { id: "3", title: "C", attributes: { stage: "active" } },
    ];

    const groups = groupRows(stageRows, {
      attributes: orderedAttributes,
      columnGrouping: "stage",
      rowGrouping: "none",
    });

    expect(groups.map((group) => group.key)).toEqual(["shipped", "backlog", "active"]);
  });
});

describe("orderRows", () => {
  it("orders by title in ascending direction", () => {
    const ordered = orderRows(rows, { attributeId: "title", direction: "asc" }, attributes);
    expect(ordered.map((row) => row.id)).toEqual(["1", "2", "3"]);
  });

  it("orders by date in descending direction", () => {
    const ordered = orderRows(rows, { attributeId: "updated", direction: "desc" }, attributes);
    expect(ordered.map((row) => row.id)).toEqual(["3", "2", "1"]);
  });

  it("orders by enum attribute using declared option index", () => {
    const priorityRows: KanbanRendererRow[] = [
      { id: "a", title: "A", attributes: { priority: "low" } },
      { id: "b", title: "B", attributes: { priority: "high" } },
      { id: "c", title: "C", attributes: { priority: "medium" } },
      { id: "d", title: "D", attributes: {} },
    ];

    const ordered = orderRows(priorityRows, { attributeId: "priority", direction: "asc" }, attributes);

    expect(ordered.map((row) => row.id)).toEqual(["b", "c", "a", "d"]);
  });

  it("returns rows unchanged when ordering is manual", () => {
    const ordered = orderRows(rows, { attributeId: MANUAL_ORDERING, direction: "asc" }, attributes);
    expect(ordered.map((row) => row.id)).toEqual(["1", "2", "3"]);
  });

  it("returns rows unchanged when ordering references an unknown attribute", () => {
    const ordered = orderRows(rows, { attributeId: "nonexistent", direction: "asc" }, attributes);
    expect(ordered.map((row) => row.id)).toEqual(["1", "2", "3"]);
  });
});

describe("filterRows", () => {
  it("returns all rows when no filters are active", () => {
    expect(filterRows(rows, {}, attributes)).toEqual(rows);
  });

  it("applies a single enum filter", () => {
    const filtered = filterRows(rows, { status: ["todo"] }, attributes);
    expect(filtered.map((row) => row.id)).toEqual(["1", "3"]);
  });

  it("applies selected enum filter values", () => {
    const filtered = filterRows(rows, { status: ["todo", "in_progress"] }, attributes);
    expect(filtered.map((row) => row.id)).toEqual(["1", "2", "3"]);
  });

  it("applies multiple filters", () => {
    const filtered = filterRows(rows, { status: ["todo"], component: ["frontend"] }, attributes);
    expect(filtered.map((row) => row.id)).toEqual(["1"]);
  });

  it("filters by enum-multi with 'has any of' semantics", () => {
    const filtered = filterRows(rows, { labels: ["bug"] }, attributes);
    expect(filtered.map((row) => row.id)).toEqual(["2"]);
  });

  it("ignores filters referencing unknown attribute ids", () => {
    const filtered = filterRows(rows, { unknown: ["x"] }, attributes);
    expect(filtered).toEqual(rows);
  });
});

describe("countFilterValues", () => {
  it("counts values for a known attribute", () => {
    const counts = countFilterValues(rows, "status", attributes);
    expect(counts.todo).toBe(2);
    expect(counts.in_progress).toBe(1);
  });

  it("counts enum-multi values across rows", () => {
    const counts = countFilterValues(rows, "labels", attributes);
    expect(counts.bug).toBe(1);
    expect(counts.regression).toBe(1);
  });

  it("returns empty for unknown attribute id", () => {
    expect(countFilterValues(rows, "unknown", attributes)).toEqual({});
  });
});
