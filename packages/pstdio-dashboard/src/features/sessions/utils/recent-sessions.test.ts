import { describe, expect, it } from "bun:test";
import type { Session } from "../types";
import { getRecentSessions } from "./recent-sessions";

const makeSession = (overrides: Partial<Session> & { id: string; updatedAt: string }): Session => {
  const { id, updatedAt, ...rest } = overrides;

  return {
    id,
    projectId: "project-1",
    agentSessionId: null,
    title: id,
    status: "in_progress",
    archived: false,
    agent: "opencode",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt,
    ...rest,
  };
};

describe("getRecentSessions", () => {
  it("sorts sessions by updatedAt descending", () => {
    const sessions = [
      makeSession({ id: "session-1", updatedAt: "2026-03-10T10:00:00.000Z" }),
      makeSession({ id: "session-2", updatedAt: "2026-03-11T10:00:00.000Z" }),
      makeSession({ id: "session-3", updatedAt: "2026-03-09T10:00:00.000Z" }),
    ];

    const recent = getRecentSessions(sessions, 6);

    expect(recent.map((session) => session.id)).toEqual(["session-2", "session-1", "session-3"]);
  });

  it("limits sessions to the requested count", () => {
    const sessions = Array.from({ length: 8 }, (_, index) =>
      makeSession({
        id: `session-${index + 1}`,
        updatedAt: `2026-03-${String(index + 1).padStart(2, "0")}T10:00:00.000Z`,
      }),
    );

    const recent = getRecentSessions(sessions, 6);

    expect(recent).toHaveLength(6);
    expect(recent[0]?.id).toBe("session-8");
    expect(recent[5]?.id).toBe("session-3");
  });
});
