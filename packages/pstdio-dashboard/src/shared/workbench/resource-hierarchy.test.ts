import { describe, expect, test } from "bun:test";
import { resourceKey } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import {
  dashboardResourceFromExtensionReference,
  dashboardResourceParent,
  normalizeExtensionHierarchyReference,
} from "./resource-hierarchy";

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

test("hierarchy fallback icons belong to the referenced resource owner", () => {
  const workbench = createWorkbench();
  workbench.resources.registerKind({ kind: "drawing", extensionId: "first", label: "First", icon: "File" });
  workbench.resources.registerKind({ kind: "drawing", extensionId: "second", label: "Second", icon: "Folder" });
  const parent = dashboardResourceParent(
    { resources: workbench.resources },
    { type: "child", id: "child", metadata: { resourceParent: { type: "drawing", id: "one", extensionId: "second" } } },
    "project",
  );
  expect(parent).toMatchObject({ type: "drawing", extensionId: "second", icon: "Folder" });
});
