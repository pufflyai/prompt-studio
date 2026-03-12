import { describe, expect, it } from "bun:test";
import { isSessionsRoutePath } from "./sessions-route";

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
