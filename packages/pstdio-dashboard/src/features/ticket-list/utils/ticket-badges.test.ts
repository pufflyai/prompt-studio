import { describe, expect, it } from "bun:test";
import type { Ticket } from "@/features/ticket-list/types";
import { buildTicketBadges } from "./ticket-badges";

const ticket = {
  id: "ticket-1",
  shorthand: "PS-1",
  title: "Fix list color",
  content: "",
  tagIds: [],
  status: "Review",
  statusColor: "gray",
  updatedAt: "2026-05-31T00:00:00.000Z",
} satisfies Ticket;

describe("buildTicketBadges", () => {
  it("uses the current status option color when status colors change", () => {
    const badges = buildTicketBadges(ticket, ["status"], {
      statusOptions: [{ name: "Review", color: "purple" }],
      tags: [],
      tagMap: new Map(),
    });

    expect(badges).toEqual([{ attributeId: "status", label: "Review", color: "purple" }]);
  });
});
