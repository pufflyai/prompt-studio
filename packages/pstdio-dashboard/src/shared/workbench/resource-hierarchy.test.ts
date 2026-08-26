import { describe, expect, test } from "bun:test";
import { dashboardResourceFromExtensionReference, normalizeExtensionHierarchyReference } from "./resource-hierarchy";

describe("dashboardResourceFromExtensionReference", () => {
  test("normalizes a view hierarchy parent without creating a resource", () => {
    expect(normalizeExtensionHierarchyReference({ type: "view", viewId: "pstdio-planner.tickets" })).toEqual({
      type: "view",
      viewId: "pstdio-planner.tickets",
    });
  });

  test("maps domain resource references", () => {
    const resource = dashboardResourceFromExtensionReference({ type: "ticket", id: "t-1" }, { projectId: "project-1" });

    expect(resource.uri).toBe("dashboard-workbench://ticket/t-1");
  });
});
