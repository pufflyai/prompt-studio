import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import {
  getSidenavContributionSections,
  registerSidenavContribution,
} from "@/shared/workbench/contributions/sidenav-tree-contributions";
import { registerExtensionNavigation } from "./extension-navigation";
import { metadataWithLabMode } from "./module-test-fixtures";

describe("registerExtensionNavigation", () => {
  test("adds project navigation items to the dashboard sidenav", async () => {
    const workbench = createWorkbenchCore();
    const metadata = {
      ...metadataWithLabMode,
      navigationItems: [
        {
          ...metadataWithLabMode.navigationItems[0],
          slot: { extensionId: "pstdio", kind: "navigation-item" as const, id: "project.navigation" },
          action: {
            kind: "command" as const,
            target: {
              command: { extensionId: "pstdio", kind: "command" as const, id: "workbench.action.switchMode" },
              params: { modeId: "pstdio.extension-lab.mode.lab" },
            },
          },
        },
      ],
    };

    const disposable = registerExtensionNavigation(workbench, metadata);
    const sections = await getSidenavContributionSections(workbench, "project");

    expect(sections).toEqual([
      {
        id: "Lab",
        label: "Lab",
        collapsible: false,
        nodes: [
          expect.objectContaining({
            id: "pstdio.extension-lab.navigation-item.labPage",
            label: "Lab",
            canHide: true,
            target: {
              kind: "command",
              commandId: "workbench.action.switchMode",
              args: { modeId: "pstdio.extension-lab.mode.lab" },
            },
          }),
        ],
      },
    ]);

    disposable.dispose();
    expect(await getSidenavContributionSections(workbench, "project")).toEqual([]);
  });

  test("places extension navigation before contextual workspace sections", async () => {
    const workbench = createWorkbenchCore();
    registerSidenavContribution(workbench, {
      id: "dashboard.workspace.sessions",
      modes: ["project"],
      order: 20,
      getSections: () => [{ id: "workspace-sessions", nodes: [{ id: "session", label: "Session" }] }],
    });

    const disposable = registerExtensionNavigation(workbench, {
      ...metadataWithLabMode,
      navigationItems: [
        {
          ...metadataWithLabMode.navigationItems[0],
          slot: { extensionId: "pstdio", kind: "navigation-item" as const, id: "project.navigation" },
        },
      ],
    });

    expect((await getSidenavContributionSections(workbench, "project")).map((section) => section.id)).toEqual([
      "Lab",
      "workspace-sessions",
    ]);

    disposable.dispose();
  });
});
