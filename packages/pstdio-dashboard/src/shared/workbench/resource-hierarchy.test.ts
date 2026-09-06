import { describe, expect, test } from "bun:test";
import { resourceKey } from "@pstdio/sdk/extensions";
import { dashboardResourceFromExtensionReference, normalizeExtensionHierarchyReference } from "./resource-hierarchy";

describe("dashboardResourceFromExtensionReference", () => {
  test("preserves resource ownership across hierarchy normalization", () => {
    const reference = {
      type: "note",
      id: "one",
      extensionId: "acme.notes",
      projectId: "other-project",
      label: "First note",
    };
    expect(normalizeExtensionHierarchyReference(reference)).toEqual(reference);
    expect(dashboardResourceFromExtensionReference(reference, { projectId: "current-project" })).toMatchObject(
      reference,
    );
  });
  test("normalizes a view hierarchy parent without creating a resource", () => {
    expect(normalizeExtensionHierarchyReference({ type: "view", viewId: "pstdio-planner.tickets" })).toEqual({
      type: "view",
      viewId: "pstdio-planner.tickets",
    });
  });
  test("maps domain resource references", () => {
    const resource = dashboardResourceFromExtensionReference({ type: "ticket", id: "t-1" }, { projectId: "project-1" });
    expect(resourceKey(resource)).toBe(resourceKey({ type: "ticket", id: "t-1" }));
  });
});
