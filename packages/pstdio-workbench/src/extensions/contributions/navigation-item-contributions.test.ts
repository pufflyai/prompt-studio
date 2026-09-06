import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbench } from "../../core";
import { registerWorkbenchExtensionNavigationItems } from "./navigation-item-contributions";

describe("extension navigation items", () => {
  test("expands named groups by default", () => {
    const workbench = createWorkbench();
    const metadata = {
      navigationItems: [
        {
          id: "pstdio.lab.navigation-item.lab",
          extensionId: "pstdio.lab",
          owner: { extensionId: "pstdio", kind: "mode" as const, id: "project" },
          slot: "content" as const,
          group: "Lab",
          label: "Lab",
          action: {
            kind: "page" as const,
            page: { extensionId: "pstdio.lab", kind: "page" as const, id: "lab" },
          },
        },
      ],
      navigationTrees: [],
    } satisfies Pick<WorkbenchExtensionMetadata, "navigationItems" | "navigationTrees">;

    registerWorkbenchExtensionNavigationItems({ metadata, workbench });

    expect(
      workbench.navigationTrees.getDefaultExpandedSectionIds({
        kind: "mode",
        id: "project",
        extensionId: "pstdio",
      }),
    ).toEqual(["pstdio.lab:Lab"]);
  });
});
