import { describe, expect, it } from "bun:test";

import type { Ticket } from "@/features/ticket-list/types";

import { filterTickets } from "./filter-tickets";

const makeTicket = (overrides: Partial<Ticket>): Ticket => ({
  id: "t0",
  shorthand: "T-0",
  title: "",
  content: "",
  tagIds: [],
  status: "backlog",
  updatedAt: "2025-01-01T00:00:00.000Z",
  ...overrides,
});

describe("filterTickets", () => {
  it("returns all tickets when query is empty", () => {
    const tickets = [makeTicket({ id: "t1", title: "Add search" }), makeTicket({ id: "t2", title: "Fix auth" })];

    expect(filterTickets(tickets, "")).toEqual(tickets);
  });

  it("filters by title, shorthand, and content", () => {
    const titleMatch = makeTicket({ id: "t1", title: "Add search" });
    const shorthandMatch = makeTicket({ id: "t2", shorthand: "ABC-123", title: "Misc" });
    const contentMatch = makeTicket({ id: "t3", content: "Investigate flaky tests" });
    const noMatch = makeTicket({ id: "t4", title: "Refactor metrics" });

    const tickets = [titleMatch, shorthandMatch, contentMatch, noMatch];

    expect(filterTickets(tickets, "search")).toEqual([titleMatch]);
    expect(filterTickets(tickets, "abc-123")).toEqual([shorthandMatch]);
    expect(filterTickets(tickets, "flaky")).toEqual([contentMatch]);
  });

  it("matches query case-insensitively", () => {
    const ticket = makeTicket({ id: "t1", title: "Add Search Feature" });
    expect(filterTickets([ticket], "search")).toEqual([ticket]);
  });
});
