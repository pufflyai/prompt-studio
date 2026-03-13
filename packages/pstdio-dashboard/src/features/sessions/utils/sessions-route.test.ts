import { describe, expect, it } from "bun:test";
import { getSessionBubbleReturnPath, getSessionsRoutePath, isSessionsRoutePath } from "./sessions-route";

const projectId = "p1";

describe("getSessionsRoutePath", () => {
  it("returns the sessions index path when no session is selected", () => {
    expect(getSessionsRoutePath(projectId, null)).toBe("/projects/p1/sessions");
  });

  it("returns a session route when session id is provided", () => {
    expect(getSessionsRoutePath(projectId, "s1")).toBe("/projects/p1/sessions/s1");
  });

  it("returns null when project id is missing", () => {
    expect(getSessionsRoutePath(undefined, "s1")).toBeNull();
  });
});

describe("isSessionsRoutePath", () => {
  it("returns true for the sessions index route", () => {
    expect(isSessionsRoutePath("/projects/p1/sessions", "p1")).toBe(true);
  });

  it("returns true for a specific session route", () => {
    expect(isSessionsRoutePath("/projects/p1/sessions/s1", "p1")).toBe(true);
  });

  it("returns false for non-session project routes", () => {
    expect(isSessionsRoutePath("/projects/p1/docs", "p1")).toBe(false);
  });

  it("returns false when project id is missing", () => {
    expect(isSessionsRoutePath("/projects/p1/sessions", undefined)).toBe(false);
  });

  it("returns false for another project's sessions route", () => {
    expect(isSessionsRoutePath("/projects/p2/sessions", "p1")).toBe(false);
  });
});

describe("getSessionBubbleReturnPath", () => {
  it("returns the last non-sessions path when available", () => {
    expect(
      getSessionBubbleReturnPath({
        projectId: "p1",
        lastNonSessionsPath: "/projects/p1/docs",
      }),
    ).toBe("/projects/p1/docs");
  });

  it("falls back to the project root when the tracked path is a sessions route", () => {
    expect(
      getSessionBubbleReturnPath({
        projectId: "p1",
        lastNonSessionsPath: "/projects/p1/sessions/s1",
      }),
    ).toBe("/projects/p1");
  });

  it("falls back to projects index when project id is missing", () => {
    expect(
      getSessionBubbleReturnPath({
        projectId: undefined,
        lastNonSessionsPath: null,
      }),
    ).toBe("/projects");
  });
});
