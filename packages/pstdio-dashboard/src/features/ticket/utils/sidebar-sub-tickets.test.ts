import { describe, expect, it } from "bun:test";
import type { Ticket } from "@/features/ticket-list/types";
import { resolveSidebarSubTickets } from "./sidebar-sub-tickets";

const buildTicket = (overrides: Partial<Ticket>): Ticket => ({
  id: "ticket-1",
  shorthand: "PS-1",
  title: "Parent",
  content: "",
  tagIds: [],
  status: "Backlog",
  updatedAt: "2026-04-24T00:00:00.000Z",
  ...overrides,
});

describe("resolveSidebarSubTickets", () => {
  it("derives direct children from the current ticket list", () => {
    const subTickets = resolveSidebarSubTickets(
      [
        buildTicket({ id: "ticket-1", shorthand: "PS-1", title: "Parent", parentId: null }),
        buildTicket({ id: "ticket-2", shorthand: "PS-2", title: "Child one", parentId: "ticket-1" }),
        buildTicket({ id: "ticket-3", shorthand: "PS-3", title: "Child two", parentId: "ticket-1" }),
        buildTicket({ id: "ticket-4", shorthand: "PS-4", title: "Other", parentId: "ticket-9" }),
      ],
      "ticket-1",
    );

    expect(subTickets).toEqual([
      { id: "ticket-2", shorthand: "PS-2", title: "Child one", statusId: null },
      { id: "ticket-3", shorthand: "PS-3", title: "Child two", statusId: null },
    ]);
  });

  it("matches children linked by parent shorthand", () => {
    const subTickets = resolveSidebarSubTickets(
      [
        buildTicket({ id: "ticket-1", shorthand: "PS-1", title: "Parent", parentId: null }),
        buildTicket({ id: "ticket-2", shorthand: "PS-2", title: "Child one", parentId: "PS-1" }),
        buildTicket({ id: "ticket-3", shorthand: "PS-3", title: "Child two", parentId: "ticket-1" }),
        buildTicket({ id: "ticket-4", shorthand: "PS-4", title: "Other", parentId: "PS-9" }),
      ],
      "ticket-1",
      "PS-1",
    );

    expect(subTickets).toEqual([
      { id: "ticket-2", shorthand: "PS-2", title: "Child one", statusId: null },
      { id: "ticket-3", shorthand: "PS-3", title: "Child two", statusId: null },
    ]);
  });
});
