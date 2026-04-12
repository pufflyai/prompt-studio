import { describe, expect, it } from "bun:test";
import { resolveTicketSidebarActiveNodeIds } from "./ticket-sidebar-selection";

describe("resolveTicketSidebarActiveNodeIds", () => {
  it("highlights both the workspace and its active session", () => {
    const activeNodeIds = resolveTicketSidebarActiveNodeIds({
      selectedFileId: "ticket",
      selectedWorkspaceId: "workspace-1",
      activeSessionId: "session-2",
      workspaceSessionIds: new Set(["session-1", "session-2"]),
    });

    expect(activeNodeIds).toEqual(["workspace:workspace-1", "session:session-2"]);
  });

  it("highlights only the workspace when session does not belong to it", () => {
    const activeNodeIds = resolveTicketSidebarActiveNodeIds({
      selectedFileId: "ticket",
      selectedWorkspaceId: "workspace-1",
      activeSessionId: "session-2",
      workspaceSessionIds: new Set(["session-1"]),
    });

    expect(activeNodeIds).toEqual(["workspace:workspace-1"]);
  });

  it("falls back to selected file when no workspace is selected", () => {
    const activeNodeIds = resolveTicketSidebarActiveNodeIds({
      selectedFileId: "file-1",
      selectedWorkspaceId: null,
      activeSessionId: null,
      workspaceSessionIds: new Set(),
    });

    expect(activeNodeIds).toEqual(["file:file-1"]);
  });
});
