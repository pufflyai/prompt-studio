import { describe, expect, test } from "bun:test";
import { getRecentDashboardSessions } from "@/modules/sessions/data/recent-dashboard-sessions";
import { createDashboardResource } from "@/shared/app/resources";
import type { DashboardSession } from "./data/dashboard-sessions";

const makeSession = (id: string, updatedAt: string, lastActivityAt = updatedAt): DashboardSession => ({
  id,
  title: id,
  status: "completed",
  agent: null,
  lastSelectedModel: null,
  updatedAt,
  lastActivityAt,
  workspaceId: null,
  workspaceBranch: null,
  workspaceShorthand: "",
  anchors: [],
  resource: createDashboardResource("session", id, id, "MessageCircle"),
});

describe("getRecentDashboardSessions", () => {
  test("returns the latest sessions by activity time", () => {
    const sessions = [
      makeSession("session-1", "2026-05-20T10:00:00Z", "2026-05-23T10:00:00Z"),
      makeSession("session-2", "2026-05-22T10:00:00Z"),
      makeSession("session-3", "2026-05-21T10:00:00Z"),
    ];

    expect(getRecentDashboardSessions(sessions, 6).map((session) => session.id)).toEqual([
      "session-1",
      "session-2",
      "session-3",
    ]);
  });

  test("limits sessions to the requested count", () => {
    const sessions = Array.from({ length: 8 }, (_, index) =>
      makeSession(`session-${index + 1}`, `2026-05-${String(index + 1).padStart(2, "0")}T10:00:00Z`),
    );

    const recentSessions = getRecentDashboardSessions(sessions, 6);

    expect(recentSessions.map((session) => session.id)).toEqual([
      "session-8",
      "session-7",
      "session-6",
      "session-5",
      "session-4",
      "session-3",
    ]);
  });
});
