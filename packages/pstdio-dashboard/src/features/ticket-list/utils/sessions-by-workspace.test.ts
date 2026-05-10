import { describe, expect, it } from "bun:test";
import { buildSessionsByWorkspace } from "./sessions-by-workspace";

describe("buildSessionsByWorkspace", () => {
  it("resolves workspace sessions from workspace_sessions join table", () => {
    const workspaceSessions = [
      { id: "link-1", workspace_id: "workspace-1", session_id: "session-1", created_at: "2026-01-01T00:00:00Z" },
    ];
    const sessions = [{ id: "session-1", status: "completed", created_at: "2026-01-01T00:00:00Z" }];

    const result = buildSessionsByWorkspace(workspaceSessions, sessions);

    expect(result.get("workspace-1")?.id).toBe("session-1");
  });

  it("returns the latest session when multiple are linked", () => {
    const workspaceSessions = [
      { id: "link-1", workspace_id: "workspace-1", session_id: "session-1", created_at: "2026-01-01T00:00:00Z" },
      { id: "link-2", workspace_id: "workspace-1", session_id: "session-2", created_at: "2026-01-02T00:00:00Z" },
    ];
    const sessions = [
      { id: "session-1", status: "completed", created_at: "2026-01-01T00:00:00Z" },
      { id: "session-2", status: "in_progress", created_at: "2026-01-02T00:00:00Z" },
    ];

    const result = buildSessionsByWorkspace(workspaceSessions, sessions);

    expect(result.get("workspace-1")?.id).toBe("session-2");
  });

  it("prefers a running session over newer inactive sessions", () => {
    const workspaceSessions = [
      { id: "link-1", workspace_id: "workspace-1", session_id: "session-1", created_at: "2026-01-01T00:00:00Z" },
      { id: "link-2", workspace_id: "workspace-1", session_id: "session-2", created_at: "2026-01-02T00:00:00Z" },
    ];
    const sessions = [
      { id: "session-1", status: "in_progress", archived: false, created_at: "2026-01-01T00:00:00Z" },
      { id: "session-2", status: "completed", archived: false, created_at: "2026-01-02T00:00:00Z" },
    ];

    const result = buildSessionsByWorkspace(workspaceSessions, sessions);

    expect(result.get("workspace-1")?.id).toBe("session-1");
  });

  it("uses a newer terminal session over an older awaiting input session when no session is running", () => {
    const workspaceSessions = [
      { id: "link-1", workspace_id: "workspace-1", session_id: "session-1", created_at: "2026-01-01T00:00:00Z" },
      { id: "link-2", workspace_id: "workspace-1", session_id: "session-2", created_at: "2026-01-02T00:00:00Z" },
    ];
    const sessions = [
      { id: "session-1", status: "awaiting_input", archived: false, created_at: "2026-01-01T00:00:00Z" },
      { id: "session-2", status: "completed", archived: false, created_at: "2026-01-02T00:00:00Z" },
    ];

    const result = buildSessionsByWorkspace(workspaceSessions, sessions);

    expect(result.get("workspace-1")?.id).toBe("session-2");
  });

  it("prefers running sessions over other active sessions", () => {
    const workspaceSessions = [
      { id: "link-1", workspace_id: "workspace-1", session_id: "session-1", created_at: "2026-01-02T00:00:00Z" },
      { id: "link-2", workspace_id: "workspace-1", session_id: "session-2", created_at: "2026-01-01T00:00:00Z" },
    ];
    const sessions = [
      { id: "session-1", status: "awaiting_input", archived: false, created_at: "2026-01-02T00:00:00Z" },
      { id: "session-2", status: "in_progress", archived: false, created_at: "2026-01-01T00:00:00Z" },
    ];

    const result = buildSessionsByWorkspace(workspaceSessions, sessions);

    expect(result.get("workspace-1")?.id).toBe("session-2");
  });

  it("ignores archived sessions when resolving the latest active session", () => {
    const workspaceSessions = [
      { id: "link-1", workspace_id: "workspace-1", session_id: "session-1", created_at: "2026-01-01T00:00:00Z" },
      { id: "link-2", workspace_id: "workspace-1", session_id: "session-2", created_at: "2026-01-02T00:00:00Z" },
    ];
    const sessions = [
      { id: "session-1", status: "failed", archived: false, created_at: "2026-01-01T00:00:00Z" },
      { id: "session-2", status: "completed", archived: true, created_at: "2026-01-02T00:00:00Z" },
    ];

    const result = buildSessionsByWorkspace(workspaceSessions, sessions);

    expect(result.get("workspace-1")?.id).toBe("session-1");
  });

  it("skips links with missing sessions", () => {
    const workspaceSessions = [
      { id: "link-1", workspace_id: "workspace-1", session_id: "missing", created_at: "2026-01-01T00:00:00Z" },
    ];

    const result = buildSessionsByWorkspace(workspaceSessions, []);

    expect(result.has("workspace-1")).toBe(false);
  });
});
