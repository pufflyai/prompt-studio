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
        buildTicket({
          id: "ticket-2",
          shorthand: "PS-2",
          title: "Child one",
          parentId: "ticket-1",
          status: "In Progress",
          statusColor: "yellow",
        }),
        buildTicket({
          id: "ticket-3",
          shorthand: "PS-3",
          title: "Child two",
          parentId: "ticket-1",
          status: "Done",
          statusColor: "green",
        }),
        buildTicket({ id: "ticket-4", shorthand: "PS-4", title: "Other", parentId: "ticket-9" }),
      ],
      "ticket-1",
    );

    expect(subTickets).toEqual([
      {
        id: "ticket-2",
        shorthand: "PS-2",
        title: "Child one",
        statusId: null,
        status: "In Progress",
        statusColor: "yellow",
      },
      {
        id: "ticket-3",
        shorthand: "PS-3",
        title: "Child two",
        statusId: null,
        status: "Done",
        statusColor: "green",
      },
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
      {
        id: "ticket-2",
        shorthand: "PS-2",
        title: "Child one",
        statusId: null,
        status: "Backlog",
        statusColor: undefined,
      },
      {
        id: "ticket-3",
        shorthand: "PS-3",
        title: "Child two",
        statusId: null,
        status: "Backlog",
        statusColor: undefined,
      },
    ]);
  });

  it("sorts child tickets by shorthand", () => {
    const subTickets = resolveSidebarSubTickets(
      [
        buildTicket({ id: "ticket-1", shorthand: "PS-1", title: "Parent", parentId: null }),
        buildTicket({ id: "ticket-3", shorthand: "PS-11", title: "Third", parentId: "ticket-1" }),
        buildTicket({ id: "ticket-2", shorthand: "PS-2", title: "Second", parentId: "ticket-1" }),
      ],
      "ticket-1",
    );

    expect(subTickets.map((ticket) => ticket.shorthand)).toEqual(["PS-2", "PS-11"]);
  });

  it("does not include tickets with undefined parentId when parent shorthand is not provided", () => {
    const subTickets = resolveSidebarSubTickets(
      [
        buildTicket({ id: "ticket-1", shorthand: "PS-1", title: "Parent", parentId: null }),
        buildTicket({ id: "ticket-2", shorthand: "PS-2", title: "Child", parentId: "ticket-1" }),
        buildTicket({ id: "ticket-3", shorthand: "PS-3", title: "Root without parent", parentId: undefined }),
      ],
      "ticket-1",
    );

    expect(subTickets.map((ticket) => ticket.id)).toEqual(["ticket-2"]);
  });
});
