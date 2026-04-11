import { describe, expect, it } from "bun:test";
import type { WorkspaceSessionEntry } from "@/features/workspaces/hooks/use-workspace-sessions";
import { resolveActiveWorkspaceSessionId } from "./selected-workspace-session";

const sessions: WorkspaceSessionEntry[] = [
  {
    id: "session-1",
    title: "Session 1",
    status: "completed",
    agent: null,
    createdAt: "2026-04-10T10:00:00.000Z",
  },
  {
    id: "session-2",
    title: "Session 2",
    status: "in_progress",
    agent: "codex",
    createdAt: "2026-04-10T11:00:00.000Z",
  },
];

describe("resolveActiveWorkspaceSessionId", () => {
  it("keeps the requested session when it belongs to the workspace", () => {
    expect(resolveActiveWorkspaceSessionId(sessions, "session-2")).toBe("session-2");
  });

  it("falls back to the first workspace session when no session is requested", () => {
    expect(resolveActiveWorkspaceSessionId(sessions, undefined)).toBe("session-1");
  });

  it("falls back to the first workspace session when the requested one is missing", () => {
    expect(resolveActiveWorkspaceSessionId(sessions, "missing-session")).toBe("session-1");
  });

  it("returns null when there are no sessions", () => {
    expect(resolveActiveWorkspaceSessionId([], undefined)).toBeNull();
  });
});
