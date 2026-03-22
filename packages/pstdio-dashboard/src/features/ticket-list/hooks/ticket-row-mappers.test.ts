import { describe, expect, it } from "bun:test";
import type { SyncedRow } from "@/features/sync/collections";
import { toTicketFromRow } from "./ticket-row-mappers";

const baseTicketRow: SyncedRow = {
  id: "ticket-1",
  shorthand: "PS-1",
  display_title: "Fix session indicator",
  status_id: "status-1",
  status_name: "In Progress",
  blocked_reason: null,
  depends_on: null,
  parent_id: null,
  archived: false,
  draft: false,
  updated_at: "2026-03-15T12:00:00.000Z",
};

describe("toTicketFromRow", () => {
  it("attaches session status from the linked session instead of workspace status", () => {
    const workspacesByTicket = new Map<string, SyncedRow[]>([
      [
        "ticket-1",
        [
          {
            id: "workspace-1",
            name: "PS-1_A1",
            status: "active",
            workspace_shorthand: "PS-1_A1",
            updated_at: "2026-03-15T12:00:00.000Z",
            worktree_path: "/tmp/ws",
          },
        ],
      ],
    ]);
    const sessionsByWorkspace = new Map<string, SyncedRow>([
      [
        "workspace-1",
        {
          id: "session-1",
          status: "completed",
        },
      ],
    ]);

    const ticket = toTicketFromRow(
      baseTicketRow,
      new Map([["status-1", "In Progress"]]),
      new Map([["status-1", "orange"]]),
      "Unassigned",
      "gray",
      new Map(),
      workspacesByTicket,
      sessionsByWorkspace,
      new Map(),
    );

    expect(ticket.attempts?.[0]?.status).toBe("active");
    expect(ticket.attempts?.[0]?.sessionStatus).toBe("completed");
  });
});
