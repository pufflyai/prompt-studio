import { describe, expect, it } from "bun:test";
import { buildSessionsByWorkspace } from "./sessions-by-workspace";

describe("buildSessionsByWorkspace", () => {
  it("resolves workspace sessions from workspace.session_id", () => {
    const workspaces = [
      { id: "workspace-1", session_id: "session-1" },
      { id: "workspace-2", session_id: null },
    ];
    const sessions = [
      { id: "session-1", workspace_id: null },
      { id: "session-2", workspace_id: "workspace-2" },
    ];

    const sessionsByWorkspace = buildSessionsByWorkspace(workspaces, sessions);

    expect(sessionsByWorkspace.get("workspace-1")?.id).toBe("session-1");
    expect(sessionsByWorkspace.has("workspace-2")).toBe(false);
  });
});
