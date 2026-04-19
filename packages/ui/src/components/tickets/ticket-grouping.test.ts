import { describe, expect, it } from "bun:test";

import { countFilterValues, filterTickets, groupTickets, orderTickets } from "./ticket-grouping";
import type { WorkspaceTagDefinition, WorkspaceTicket } from "./types";

const tickets: WorkspaceTicket[] = [
  {
    id: "1",
    ticketId: "PS-1",
    title: "Alpha",
    status: "todo",
    assignee: "Alice",
    tags: [{ name: "component", value: "frontend" }],
    updatedAt: "2026-03-10T00:00:00.000Z",
  },
  {
    id: "2",
    ticketId: "PS-2",
    title: "Beta",
    status: "in_progress",
    assignee: "Bob",
    tags: [
      { name: "component", value: "backend" },
      { name: "priority", value: "high" },
    ],
    updatedAt: "2026-03-11T00:00:00.000Z",
  },
  {
    id: "3",
    ticketId: "PS-3",
    title: "Gamma",
    status: "todo",
    assignee: null,
    tags: [],
    updatedAt: "2026-03-12T00:00:00.000Z",
  },
];

describe("groupTickets", () => {
  it("groups by primary field", () => {
    const groups = groupTickets(tickets, { columnGrouping: "status", rowGrouping: "none" });

    expect(groups.length).toBe(2);
    expect(groups[0]?.key).toBe("in_progress");
    expect(groups[1]?.key).toBe("todo");
  });

  it("groups by primary and secondary field", () => {
    const groups = groupTickets(tickets, { columnGrouping: "status", rowGrouping: "assignee" });

    expect(groups[1]?.rows.length).toBe(2);
    expect(groups[1]?.rows[0]?.key).toBe("Alice");
    expect(groups[1]?.rows[1]?.key).toBe("Unassigned");
  });

  it("preserves empty columns for known keys", () => {
    const groups = groupTickets(tickets, {
      columnGrouping: "status",
      rowGrouping: "none",
      knownColumnKeys: ["todo", "in_progress", "done"],
    });

    expect(groups.length).toBe(3);
    expect(groups.map((g) => g.key)).toEqual(["done", "in_progress", "todo"]);
    expect(groups[0]?.tickets.length).toBe(0);
  });

  it("groups by tag field", () => {
    const groups = groupTickets(tickets, { columnGrouping: "tag:component", rowGrouping: "none" });

    expect(groups.map((g) => g.key)).toEqual(["backend", "frontend", "No component"]);
    expect(groups[0]?.tickets.length).toBe(1);
    expect(groups[1]?.tickets.length).toBe(1);
    expect(groups[2]?.tickets.length).toBe(1);
  });
});

describe("orderTickets", () => {
  it("orders by title in ascending direction", () => {
    const ordered = orderTickets(tickets, { field: "title", direction: "asc" });

    expect(ordered.map((ticket) => ticket.ticketId)).toEqual(["PS-1", "PS-2", "PS-3"]);
  });

  it("orders by updated date in descending direction", () => {
    const ordered = orderTickets(tickets, { field: "updated", direction: "desc" });

    expect(ordered.map((ticket) => ticket.ticketId)).toEqual(["PS-3", "PS-2", "PS-1"]);
  });

  it("orders by tag field using lexical fallback without definitions", () => {
    const ordered = orderTickets(tickets, { field: "tag:component", direction: "asc" });

    expect(ordered.map((ticket) => ticket.ticketId)).toEqual(["PS-3", "PS-2", "PS-1"]);
  });

  it("orders by tag field using predefined definition order", () => {
    const tagDefs: WorkspaceTagDefinition[] = [
      {
        name: "priority",
        label: "Priority",
        options: [
          { value: "high", label: "High" },
          { value: "medium", label: "Medium" },
          { value: "low", label: "Low" },
        ],
      },
    ];

    const priorityTickets: WorkspaceTicket[] = [
      { id: "a", ticketId: "PS-A", title: "A", tags: [{ name: "priority", value: "low" }] },
      { id: "b", ticketId: "PS-B", title: "B", tags: [{ name: "priority", value: "high" }] },
      { id: "c", ticketId: "PS-C", title: "C", tags: [{ name: "priority", value: "medium" }] },
      { id: "d", ticketId: "PS-D", title: "D", tags: [] },
    ];

    const ordered = orderTickets(priorityTickets, { field: "tag:priority", direction: "asc" }, tagDefs);

    // high (0) → medium (1) → low (2) → untagged (last)
    expect(ordered.map((t) => t.ticketId)).toEqual(["PS-B", "PS-C", "PS-A", "PS-D"]);
  });

  it("places unknown tag values after defined options", () => {
    const tagDefs: WorkspaceTagDefinition[] = [
      {
        name: "priority",
        label: "Priority",
        options: [
          { value: "high", label: "High" },
          { value: "medium", label: "Medium" },
          { value: "low", label: "Low" },
        ],
      },
    ];

    const priorityTickets: WorkspaceTicket[] = [
      { id: "a", ticketId: "PS-A", title: "A", tags: [{ name: "priority", value: "high" }] },
      { id: "b", ticketId: "PS-B", title: "B", tags: [{ name: "priority", value: "urgent" }] },
      { id: "c", ticketId: "PS-C", title: "C", tags: [{ name: "priority", value: "medium" }] },
    ];

    const ordered = orderTickets(priorityTickets, { field: "tag:priority", direction: "asc" }, tagDefs);

    expect(ordered.map((t) => t.ticketId)).toEqual(["PS-A", "PS-C", "PS-B"]);
  });
});

describe("filterTickets", () => {
  it("returns all tickets when no filters are active", () => {
    const filtered = filterTickets(tickets, {});

    expect(filtered).toEqual(tickets);
  });

  it("applies one category", () => {
    const filtered = filterTickets(tickets, { status: ["todo"] });

    expect(filtered.map((ticket) => ticket.ticketId)).toEqual(["PS-1", "PS-3"]);
  });

  it("applies multiple categories including tag", () => {
    const filtered = filterTickets(tickets, {
      status: ["todo"],
      "tag:component": ["frontend"],
    });

    expect(filtered.map((ticket) => ticket.ticketId)).toEqual(["PS-1"]);
  });

  it("filters by tag category", () => {
    const filtered = filterTickets(tickets, { "tag:component": ["backend"] });

    expect(filtered.map((ticket) => ticket.ticketId)).toEqual(["PS-2"]);
  });
});

describe("countFilterValues", () => {
  it("counts values by category", () => {
    const counts = countFilterValues(tickets, "status");

    expect(counts.todo).toBe(2);
    expect(counts.in_progress).toBe(1);
  });

  it("counts values by tag category", () => {
    const counts = countFilterValues(tickets, "tag:component");

    expect(counts.frontend).toBe(1);
    expect(counts.backend).toBe(1);
  });
});
