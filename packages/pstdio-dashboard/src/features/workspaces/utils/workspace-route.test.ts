import { describe, expect, it } from "bun:test";
import { isWorkspaceRoutePath } from "./workspace-route";

describe("isWorkspaceRoutePath", () => {
  it("returns true for a workspace route", () => {
    expect(isWorkspaceRoutePath("/projects/p1/tickets/TK-1/workspaces/W-1", "p1")).toBe(true);
  });

  it("returns true for nested workspace routes", () => {
    expect(isWorkspaceRoutePath("/projects/p1/tickets/TK-1/workspaces/W-1/files", "p1")).toBe(true);
  });

  it("returns false for non-workspace ticket routes", () => {
    expect(isWorkspaceRoutePath("/projects/p1/tickets/TK-1", "p1")).toBe(false);
  });

  it("returns false for sessions routes", () => {
    expect(isWorkspaceRoutePath("/projects/p1/sessions/s1", "p1")).toBe(false);
  });

  it("returns false when project id is missing", () => {
    expect(isWorkspaceRoutePath("/projects/p1/tickets/TK-1/workspaces/W-1", undefined)).toBe(false);
  });

  it("returns false for another project's workspace route", () => {
    expect(isWorkspaceRoutePath("/projects/p2/tickets/TK-1/workspaces/W-1", "p1")).toBe(false);
  });
});
