import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { withoutIntegratedResourceSidenavViews } from "./extension-resource-sidenav";
import { metadata } from "./module-test-fixtures";

const plannerMetadata = {
  ...metadata,
  views: [
    {
      id: "pstdio.planner.view.files",
      localId: "files",
      extensionId: "pstdio.planner",
      title: "Files",
      body: { kind: "tree" as const, bodyHandlerId: "pstdio.planner.command.files.query" },
    },
  ],
  resourceViews: [
    {
      id: "pstdio.planner.resource-view.files",
      extensionId: "pstdio.planner",
      resourceKind: { extensionId: "pstdio.planner", kind: "resource-kind" as const, id: "ticket" },
      slot: {
        resourceKind: { extensionId: "pstdio.planner", kind: "resource-kind" as const, id: "ticket" },
        id: "navigation",
      },
      view: { extensionId: "pstdio.planner", kind: "view" as const, id: "files" },
    },
  ],
  placements: [
    {
      id: "pstdio.planner.placement.ticket-navigation",
      localId: "ticket-navigation",
      extensionId: "pstdio.planner",
      mode: { extensionId: "pstdio", kind: "mode" as const, id: "project" },
      item: {
        kind: "resource-slot" as const,
        slot: {
          resourceKind: { extensionId: "pstdio.planner", kind: "resource-kind" as const, id: "ticket" },
          id: "navigation",
        },
      },
      region: "sidenav" as const,
      required: true,
    },
  ],
} satisfies WorkbenchExtensionMetadata;

describe("withoutIntegratedResourceSidenavViews", () => {
  test("leaves project resource trees inside the persistent dashboard sidenav", () => {
    const adapted = withoutIntegratedResourceSidenavViews(plannerMetadata);

    expect(adapted.resourceViews).toEqual([]);
    expect(adapted.placements).toEqual([]);
    expect(adapted.views).toEqual(plannerMetadata.views);
  });
});
