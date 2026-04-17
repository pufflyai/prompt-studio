import { describe, expect, it } from "bun:test";
import type { Ticket } from "@/features/ticket-list/types";

import type { BadgeContext, DisplayProperty } from "../types";
import { buildTicketBadges } from "./ticket-badges";

const makeTicket = (overrides: Partial<Ticket>): Ticket => ({
  id: "ticket-1",
  shorthand: "PS-1",
  title: "Ticket",
  content: "",
  tagIds: [],
  status: "backlog",
  statusColor: "gray",
  updatedAt: "2026-03-13T10:00:00.000Z",
  ...overrides,
});

const baseContext: BadgeContext = {
  statusOptions: [{ name: "backlog", color: "gray" }],
  tags: [],
  tagMap: new Map(),
  ticketShorthandById: {},
};

describe("buildTicketBadges", () => {
  it("builds stable ids for status, assignee, parent and updated badges", () => {
    const ticket = makeTicket({
      status: "in_progress",
      assignee: "Alex",
      parentId: "parent-1",
      updatedAt: "2026-04-01T12:00:00.000Z",
    });

    const context: BadgeContext = {
      ...baseContext,
      ticketShorthandById: { "parent-1": "PS-0" },
    };

    const badges = buildTicketBadges(ticket, ["parentId", "status", "assignee", "updatedAt"], context);

    expect(badges.map((badge) => badge.id)).toEqual([
      "parent:parent-1",
      "status:in_progress",
      "assignee:Alex",
      "updated:2026-04-01T12:00:00.000Z",
    ]);
    expect(badges[0]?.label).toBe("PS-0");
    expect(badges[1]?.label).toBe("in_progress");
    expect(badges[2]?.label).toBe("Alex");
    expect(typeof badges[3]?.label).toBe("string");
  });

  it("includes tag name with option label and keeps duplicate options distinct by id", () => {
    const displayProperties: DisplayProperty[] = ["tags"];
    const ticket = makeTicket({ tagIds: ["severity-bug", "type-bug"] });

    const context: BadgeContext = {
      ...baseContext,
      tags: [
        { id: "severity-bug", name: "bug", color: "red", tagName: "severity" },
        { id: "type-bug", name: "bug", color: "orange", tagName: "type" },
      ],
      tagMap: new Map([
        ["severity-bug", { id: "severity-bug", name: "bug", color: "red", tagName: "severity" }],
        ["type-bug", { id: "type-bug", name: "bug", color: "orange", tagName: "type" }],
      ]),
    };

    const badges = buildTicketBadges(ticket, displayProperties, context);

    expect(badges).toEqual([
      { id: "tag:severity-bug", label: "severity: bug", color: "red" },
      { id: "tag:type-bug", label: "type: bug", color: "orange" },
    ]);
  });
});
