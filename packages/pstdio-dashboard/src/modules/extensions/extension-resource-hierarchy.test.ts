import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench/core";
import { emptyDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { registerExtensionResourceHierarchy } from "./extension-resource-hierarchy";

const metadataFor = (extensionId: string, rendererId: string, resourceKind: string) => ({
  ...emptyDashboardExtensionMetadata,
  dataRenderers: [
    {
      id: rendererId,
      extensionId,
      title: rendererId,
      resourceKind,
      queryCommandId: `${rendererId}.query`,
    },
  ],
});

describe("registerExtensionResourceHierarchy", () => {
  test("registers hierarchy roots from multiple extensions in one project", () => {
    const workbench = createWorkbenchCore();

    registerExtensionResourceHierarchy(workbench, {
      metadata: metadataFor("pstdio.planner", "planner.tickets", "ticket"),
      projectId: "project-1",
    });
    registerExtensionResourceHierarchy(workbench, {
      metadata: metadataFor("pstdio.docs", "docs.pages", "document"),
      projectId: "project-1",
    });

    expect(workbench.resources.listHierarchyProviders().map((provider) => provider.id)).toEqual([
      "dashboard.extensions.resource-hierarchy.project-1.pstdio.docs",
      "dashboard.extensions.resource-hierarchy.project-1.pstdio.planner",
    ]);
  });
});
