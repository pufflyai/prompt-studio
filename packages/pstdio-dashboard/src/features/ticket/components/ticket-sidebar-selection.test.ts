import { describe, expect, it } from "bun:test";
import { resolveTicketSidebarActiveNodeId } from "./ticket-sidebar-selection";

describe("resolveTicketSidebarActiveNodeId", () => {
  it("highlights the selected session when it belongs to the active workspace", () => {
    const activeNodeId = resolveTicketSidebarActiveNodeId({
      selectedFileId: "ticket",
      selectedWorkspaceId: "workspace-1",
      activeSessionId: "session-2",
      workspaceSessionIds: new Set(["session-1", "session-2"]),
    });

    expect(activeNodeId).toBe("session:session-2");
  });

  it("falls back to the workspace when session does not belong to it", () => {
    const activeNodeId = resolveTicketSidebarActiveNodeId({
      selectedFileId: "ticket",
      selectedWorkspaceId: "workspace-1",
      activeSessionId: "session-2",
      workspaceSessionIds: new Set(["session-1"]),
    });

    expect(activeNodeId).toBe("workspace:workspace-1");
  });

  it("falls back to selected file when no workspace is selected", () => {
    const activeNodeId = resolveTicketSidebarActiveNodeId({
      selectedFileId: "file-1",
      selectedWorkspaceId: null,
      activeSessionId: null,
      workspaceSessionIds: new Set(),
    });

    expect(activeNodeId).toBe("file:file-1");
  });
});
