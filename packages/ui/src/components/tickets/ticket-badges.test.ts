import { describe, expect, it } from "bun:test";

import { createTicketBadges } from "./ticket-badges";
import type { WorkspaceTicket } from "./types";

const baseTicket: WorkspaceTicket = {
  id: "1",
  ticketId: "PS-42",
  title: "Test ticket",
  status: "todo",
  assignee: "alice",
  labels: ["backend"],
  updatedAt: "2026-03-10T00:00:00.000Z",
};

describe("createTicketBadges", () => {
  it("renders an assignee badge when assignee is in display properties", () => {
    const badges = createTicketBadges(baseTicket, { displayProperties: ["assignee"] });

    expect(badges).toHaveLength(1);
    expect(badges[0]?.label).toBe("alice");
  });

  it("does not make label badges interactive when labels filtering is unavailable", () => {
    const onLabelClick = () => {};

    const badges = createTicketBadges(baseTicket, {
      displayProperties: ["labels"],
      canFilterLabels: false,
      onLabelClick,
    });

    expect(badges).toHaveLength(1);
    expect(badges[0]?.label).toBe("backend");
    expect(badges[0]?.onClick).toBeUndefined();
  });
});
