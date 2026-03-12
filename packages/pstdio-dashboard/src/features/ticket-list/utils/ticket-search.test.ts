import { describe, expect, it } from "bun:test";

import type { Ticket } from "@/features/ticket-list/types";

import { matchesTicketSearch } from "./ticket-search";

const makeTicket = (overrides: Partial<Ticket>): Ticket => ({
  id: "t0",
  shorthand: "T0",
  title: "",
  content: "",
  tagIds: [],
  status: "backlog",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("matchesTicketSearch", () => {
  it("returns true for empty search text", () => {
    const ticket = makeTicket({ title: "Add search feature" });
    expect(matchesTicketSearch(ticket, "")).toBe(true);
    expect(matchesTicketSearch(ticket, "   ")).toBe(true);
  });

  it("matches title and shorthand case-insensitively", () => {
    const ticket = makeTicket({ title: "Add Search Feature", shorthand: "T13" });
    expect(matchesTicketSearch(ticket, "search")).toBe(true);
    expect(matchesTicketSearch(ticket, "t13")).toBe(true);
  });

  it("matches content when title does not match", () => {
    const ticket = makeTicket({ title: "Fix login", content: "Investigate search index behavior" });
    expect(matchesTicketSearch(ticket, "index")).toBe(true);
  });

  it("returns false when no ticket field matches", () => {
    const ticket = makeTicket({ title: "Fix login bug", content: "No mention of this term" });
    expect(matchesTicketSearch(ticket, "search")).toBe(false);
  });
});
