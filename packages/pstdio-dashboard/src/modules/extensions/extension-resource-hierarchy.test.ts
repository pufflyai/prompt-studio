import { describe, expect, test } from "bun:test";
import { createWorkbenchCore, type ResourceRef } from "@pstdio/workbench";
import { emptyDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { registerExtensionResourceHierarchy } from "./extension-resource-hierarchy";

describe("registerExtensionResourceHierarchy", () => {
  test("resolves explicit resource parent metadata without creating a renderer root", async () => {
    const workbench = createWorkbenchCore();
    workbench.resources.registerKind({ kind: "ticket", label: "Ticket" });
    registerExtensionResourceHierarchy(workbench, {
      metadata: {
        ...emptyDashboardExtensionMetadata,
        extensions: [{ id: "pstdio.planner", name: "planner", displayName: "Planner", sourcePath: "" }],
      },
      projectId: "project-1",
    });
    const child = {
      kind: "ticket",
      uri: "dashboard-workbench://ticket/child",
      id: "child",
      metadata: { resourceParent: { type: "ticket", id: "parent", label: "Parent" } },
    } satisfies ResourceRef;

    const parent = workbench.resources.walkHierarchy(child)[0];

    expect(parent).toMatchObject({ kind: "ticket", id: "parent", label: "Parent" });
  });

  test("walks a planner-style lineage from the Tickets browse root to the child ticket", () => {
    const workbench = createWorkbenchCore();
    workbench.resources.registerKind({ kind: "ticket", label: "Ticket" });
    registerExtensionResourceHierarchy(workbench, {
      metadata: {
        ...emptyDashboardExtensionMetadata,
        extensions: [{ id: "pstdio.planner", name: "pstdio-planner", displayName: "Planner", sourcePath: "" }],
      },
      projectId: "project-1",
    });
    const child = {
      kind: "ticket",
      uri: "dashboard-workbench://ticket/child",
      id: "child",
      label: "PS-2 Child",
      metadata: {
        resourceParent: {
          type: "ticket",
          id: "parent",
          label: "PS-1 Parent",
          metadata: {
            resourceParent: {
              type: "extension-view",
              id: "pstdio-planner.tickets",
              label: "Tickets",
              metadata: { extensionId: "pstdio.planner" },
            },
          },
        },
      },
    } satisfies ResourceRef;

    const path = workbench.resources.walkHierarchy(child);

    expect(path.map((resource) => resource.label)).toEqual(["Tickets", "PS-1 Parent", "PS-2 Child"]);
    expect(path[0]).toMatchObject({
      kind: "extension-view",
      uri: "dashboard-workbench://project/project-1/extension-views/pstdio-planner.tickets",
    });
  });
});
