import { expect, test } from "bun:test";
import type { DashboardExtensionMetadata } from "./workbench-extension-contributions";
import { emptyDashboardExtensionMetadata } from "./workbench-extension-contributions";
import { buildDashboardExtensionTreeSections } from "./workbench-extension-tree-sections";

test("maps panel tree items to project navigation resources", () => {
  const metadata = {
    ...emptyDashboardExtensionMetadata,
    treeItems: [
      {
        id: "extension-lab.board-link",
        extensionId: "pstdio.extension-lab",
        target: "workbench.left.tree",
        label: "Board",
        action: { kind: "panel", panelId: "extension-lab.board" },
      },
    ],
    panels: [
      {
        id: "extension-lab.board",
        extensionId: "pstdio.extension-lab",
        title: "Board",
        supportedRegions: ["main"],
      },
    ],
  } satisfies DashboardExtensionMetadata;

  const sections = buildDashboardExtensionTreeSections({
    metadata,
    modeId: "project",
    projectId: "project-1",
    target: "workbench.left.tree",
  });

  expect(sections[0]?.nodes[0]).toMatchObject({
    id: "dashboard-workbench://project/project-1/extension-views/extension-lab.board",
    resource: {
      kind: "extension-view",
      id: "extension-lab.board",
      metadata: {
        extensionId: "pstdio.extension-lab",
        navigationModeId: "project",
        projectId: "project-1",
      },
    },
  });
});
