import { describe, expect, it } from "bun:test";
import type { Session } from "../types";
import { getVisibleSessions } from "./visible-sessions";

const makeSession = (overrides: Partial<Session> & { id: string; archived: boolean }): Session => {
  const { id, archived, ...rest } = overrides;

  return {
    id,
    projectId: "project-1",
    agentSessionId: null,
    title: id,
    status: "in_progress",
    archived,
    agent: "opencode",
    lastSelectedModel: "openai/gpt-5.5",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    ...rest,
  };
};

describe("getVisibleSessions", () => {
  it("filters out archived sessions", () => {
    const sessions = [
      makeSession({ id: "s1", archived: false }),
      makeSession({ id: "s2", archived: true }),
      makeSession({ id: "s3", archived: false }),
    ];

    const visible = getVisibleSessions(sessions);

    expect(visible.map((session) => session.id)).toEqual(["s1", "s3"]);
  });

  it("preserves ordering for visible sessions", () => {
    const sessions = [
      makeSession({ id: "s1", archived: false }),
      makeSession({ id: "s2", archived: false }),
      makeSession({ id: "s3", archived: false }),
    ];

    const visible = getVisibleSessions(sessions);

    expect(visible.map((session) => session.id)).toEqual(["s1", "s2", "s3"]);
  });
});
