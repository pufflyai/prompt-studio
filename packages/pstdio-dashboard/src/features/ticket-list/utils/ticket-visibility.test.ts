import { describe, expect, it } from "bun:test";
import type { Ticket } from "@/features/ticket-list/types";
import { getVisibleTickets } from "./ticket-visibility";

const makeTicket = (overrides: Partial<Ticket>): Ticket => ({
  id: "t0",
  shorthand: "PS-0",
  title: "",
  content: "",
  tagIds: [],
  status: "backlog",
  updatedAt: "",
  ...overrides,
});

describe("getVisibleTickets", () => {
  it("filters out archived and draft tickets", () => {
    const active = makeTicket({ id: "1", shorthand: "PS-1", archived: false, draft: false });
    const archived = makeTicket({ id: "2", shorthand: "PS-2", archived: true, draft: false });
    const draft = makeTicket({ id: "3", shorthand: "PS-3", archived: false, draft: true });

    expect(getVisibleTickets([active, archived, draft])).toEqual([active]);
  });

  it("filters out deleted tickets", () => {
    const active = makeTicket({ id: "1", shorthand: "PS-1" });
    const deleted = makeTicket({ id: "2", shorthand: "PS-2", deletedAt: "2026-03-19T00:00:00Z" });

    expect(getVisibleTickets([active, deleted])).toEqual([active]);
  });
});
