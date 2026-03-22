import { describe, expect, it } from "bun:test";

import type { Ticket } from "@/features/ticket-list/types";

import { orderTickets } from "./ticket-grouping";

const makeTicket = (overrides: Partial<Ticket>): Ticket => ({
  id: "t-0",
  shorthand: "PS-0",
  title: "",
  content: "",
  tagIds: [],
  status: "todo",
  updatedAt: "2026-03-10T00:00:00.000Z",
  ...overrides,
});

describe("orderTickets", () => {
  it("orders manual view by created date descending", () => {
    const oldest = makeTicket({
      id: "t-1",
      shorthand: "PS-1",
      createdAt: "2026-03-10T00:00:00.000Z",
    });
    const newest = makeTicket({
      id: "t-3",
      shorthand: "PS-3",
      createdAt: "2026-03-12T00:00:00.000Z",
    });
    const middle = makeTicket({
      id: "t-2",
      shorthand: "PS-2",
      createdAt: "2026-03-11T00:00:00.000Z",
    });

    const ordered = orderTickets([oldest, newest, middle], "manual");

    expect(ordered.map((ticket) => ticket.shorthand)).toEqual(["PS-3", "PS-2", "PS-1"]);
  });
});
