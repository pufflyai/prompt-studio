import { describe, expect, test } from "bun:test";
import { parseDashboardLocation } from "./dashboard-navigation";

describe("parseDashboardLocation", () => {
  test("defaults the project root to the tickets view", () => {
    expect(parseDashboardLocation("/projects/proj-1")).toEqual({
      kind: "resource",
      resource: expect.objectContaining({ kind: "dashboard-view", id: "tickets" }),
    });
  });

  test("parses the tickets board", () => {
    const target = parseDashboardLocation("/projects/proj-1/tickets");
    expect(target).toMatchObject({ kind: "resource", resource: { kind: "dashboard-view", id: "tickets" } });
  });

  test("parses a single ticket", () => {
    const target = parseDashboardLocation("/projects/proj-1/tickets/PS-298");
    expect(target).toMatchObject({ kind: "resource", resource: { kind: "ticket", id: "PS-298" } });
  });

  test("parses a nested workspace into a compound target", () => {
    const target = parseDashboardLocation("/projects/proj-1/tickets/PS-298/workspaces/ws-7?tab=diffs");
    expect(target.kind).toBe("compound");
    if (target.kind !== "compound") throw new Error("expected compound target");
    expect(target.targets[0]).toMatchObject({ kind: "resource", resource: { kind: "ticket", id: "PS-298" } });
    expect(target.targets[1]).toMatchObject({
      kind: "resource",
      resource: { kind: "workspace", id: "ws-7", metadata: { tab: "diffs" } },
    });
  });

  test("parses sessions surface and a single session", () => {
    expect(parseDashboardLocation("/projects/proj-1/sessions")).toMatchObject({
      resource: { kind: "dashboard-view", id: "sessions" },
    });
    expect(parseDashboardLocation("/projects/proj-1/sessions/sess-3")).toMatchObject({
      resource: { kind: "session", id: "sess-3" },
    });
  });

  test("folds the legacy ?panel= query into a settings-section resource", () => {
    expect(parseDashboardLocation("/projects/proj-1/settings?panel=repositories")).toMatchObject({
      resource: { kind: "settings-section", id: "repositories" },
    });
    expect(parseDashboardLocation("/projects/proj-1/settings")).toMatchObject({
      resource: { kind: "settings-section", id: "general" },
    });
  });

  test("parses an extension route path", () => {
    expect(parseDashboardLocation("/projects/proj-1/extensions/lab/home")).toMatchObject({
      resource: { kind: "extension-route", id: "lab/home" },
    });
  });

  test("works without a project prefix", () => {
    expect(parseDashboardLocation("/tickets/PS-1")).toMatchObject({
      resource: { kind: "ticket", id: "PS-1" },
    });
  });
});
