import { describe, expect, it } from "bun:test";
import type { Session } from "../types";
import { getDateLabel, groupSessionsByDate } from "./group-sessions";

const makeSession = (overrides: Partial<Session> & { updatedAt: string }): Session => ({
  id: "s1",
  projectId: "p1",
  agentSessionId: null,
  title: "Test session",
  status: "completed",
  archived: false,
  agent: "claude-code",
  createdAt: "2026-03-01T10:00:00.000Z",
  ...overrides,
});

describe("getDateLabel", () => {
  it("returns 'Today' for today's date", () => {
    const now = new Date();
    expect(getDateLabel(now)).toBe("Today");
  });

  it("returns 'Yesterday' for yesterday's date", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(getDateLabel(yesterday)).toBe("Yesterday");
  });

  it("returns a formatted date for older dates", () => {
    const old = new Date(2025, 0, 15);
    const label = getDateLabel(old);
    expect(label).toContain("Jan");
    expect(label).toContain("15");
  });
});

describe("groupSessionsByDate", () => {
  it("groups sessions by their updatedAt date label", () => {
    const now = new Date();
    const todayISO = now.toISOString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayISO = yesterday.toISOString();

    const sessions: Session[] = [
      makeSession({ id: "s1", updatedAt: todayISO }),
      makeSession({ id: "s2", updatedAt: todayISO }),
      makeSession({ id: "s3", updatedAt: yesterdayISO }),
    ];

    const groups = groupSessionsByDate(sessions);

    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe("Today");
    expect(groups[0].sessions).toHaveLength(2);
    expect(groups[1].label).toBe("Yesterday");
    expect(groups[1].sessions).toHaveLength(1);
  });

  it("returns an empty array for no sessions", () => {
    expect(groupSessionsByDate([])).toEqual([]);
  });

  it("sorts sessions by updatedAt descending within groups", () => {
    // Pin to noon so subtracting 1 hour never crosses a day boundary
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    const earlier = new Date(now.getTime() - 3600_000).toISOString();
    const later = now.toISOString();

    const sessions: Session[] = [
      makeSession({ id: "s1", title: "Earlier", updatedAt: earlier }),
      makeSession({ id: "s2", title: "Later", updatedAt: later }),
    ];

    const groups = groupSessionsByDate(sessions);
    expect(groups).toHaveLength(1);
    expect(groups[0].sessions[0].title).toBe("Later");
    expect(groups[0].sessions[1].title).toBe("Earlier");
  });
});
