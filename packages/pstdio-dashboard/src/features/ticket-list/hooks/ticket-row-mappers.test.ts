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
            attempt_status_id: null,
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

    expect(ticket.attempts?.[0]?.attemptStatusId).toBeNull();
    expect(ticket.attempts?.[0]?.sessionStatus).toBe("completed");
  });

  it("sorts attempts by shorthand", () => {
    const workspacesByTicket = new Map<string, SyncedRow[]>([
      [
        "ticket-1",
        [
          {
            id: "workspace-3",
            name: "PS-1_A3",
            attempt_status_id: null,
            workspace_shorthand: "PS-1_A3",
            updated_at: "2026-03-15T14:00:00.000Z",
            worktree_path: null,
          },
          {
            id: "workspace-1",
            name: "PS-1_A1",
            attempt_status_id: null,
            workspace_shorthand: "PS-1_A1",
            updated_at: "2026-03-15T12:00:00.000Z",
            worktree_path: null,
          },
          {
            id: "workspace-2",
            name: "PS-1_A2",
            attempt_status_id: null,
            workspace_shorthand: "PS-1_A2",
            updated_at: "2026-03-15T13:00:00.000Z",
            worktree_path: null,
          },
        ],
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
      new Map(),
      new Map(),
    );

    expect(ticket.attempts.map((a) => a.shorthand)).toEqual(["PS-1_A1", "PS-1_A2", "PS-1_A3"]);
  });
});
