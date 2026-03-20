import { describe, expect, it } from "bun:test";

import { countFilterValues, filterTickets, groupTickets, orderTickets } from "./ticket-grouping";
import type { WorkspaceTicket } from "./types";

const tickets: WorkspaceTicket[] = [
  {
    id: "1",
    ticketId: "PS-1",
    title: "Alpha",
    status: "todo",
    complexity: "high",
    priority: "p1",
    assignee: "Alice",
    labels: ["frontend"],
    updatedAt: "2026-03-10T00:00:00.000Z",
  },
  {
    id: "2",
    ticketId: "PS-2",
    title: "Beta",
    status: "in_progress",
    complexity: "medium",
    priority: "p2",
    assignee: "Bob",
    labels: ["backend", "api"],
    updatedAt: "2026-03-11T00:00:00.000Z",
  },
  {
    id: "3",
    ticketId: "PS-3",
    title: "Gamma",
    status: "todo",
    complexity: null,
    priority: "p3",
    assignee: null,
    labels: [],
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

  it("applies multiple categories", () => {
    const filtered = filterTickets(tickets, {
      status: ["todo"],
      labels: ["frontend"],
    });

    expect(filtered.map((ticket) => ticket.ticketId)).toEqual(["PS-1"]);
  });
});

describe("countFilterValues", () => {
  it("counts values by category", () => {
    const counts = countFilterValues(tickets, "status");

    expect(counts.todo).toBe(2);
    expect(counts.in_progress).toBe(1);
  });
});
