import { Box } from "@chakra-ui/react";
import type { CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { createWorkbench, type TreeNode } from "../../../core";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import { WorkbenchTreeView } from "./tree-view";

const createFixture = () => {
  const workbench = createWorkbench();
  const sessions: TreeNode[] = [
    { id: "research", label: "Research", icon: "circle-check" },
    { id: "planning", label: "Plan next release", icon: "circle-check" },
  ];
  const pinned = new Set<string>();
  workbench.views.registerView({
    id: "sessions",
    title: "Sessions",
    body: {
      kind: "tree",
      defaultExpandedNodeIds: ["pinned-sessions"],
      getChildren: (node) => node.children ?? [],
      getBody: () => [
        {
          id: "pinned",
          nodes: [
            {
              id: "pinned-sessions",
              label: "Pinned",
              icon: "pin",
              collapsible: true,
              canDrop: true,
              children: sessions.filter((node) => pinned.has(node.id)).map((node) => ({ ...node, canDrop: true })),
            },
          ],
        },
        {
          id: "sessions",
          label: "Sessions",
          collapsible: false,
          nodes: sessions.filter((node) => !pinned.has(node.id)).map((node) => ({ ...node, canDrag: true })),
        },
      ],
      moveNode: (source, target) => {
        if (target?.canDrop) pinned.add(source.id);
      },
    },
  });
  return workbench;
};

const onSidenavContextActionsChange = () => {};

export const PinSessions = () => {
  const [workbench] = useState(createFixture);
  return (
    <WorkbenchThemeProvider>
      <Box w="80" h="80">
        <WorkbenchTreeView
          workbench={workbench}
          treeViewId="sessions"
          onSidenavContextActionsChange={onSidenavContextActionsChange}
        />
      </Box>
    </WorkbenchThemeProvider>
  );
};

export default {
  title: "Product/Workbench/Navigation/Tree/Session pinning",
  description: "Drag a session onto Pinned or onto a session that is already pinned.",
} satisfies CanvasMeta;
