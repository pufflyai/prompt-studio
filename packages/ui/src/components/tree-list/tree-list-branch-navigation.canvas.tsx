import { Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
import { TreeList } from "./tree-list";

const NavigableBranch = () => {
  const [expanded, setExpanded] = useState<string[]>([]);
  const [opened, setOpened] = useState("Nothing open");
  return (
    <Stack>
      <TreeList
        sections={[
          {
            id: "project",
            nodes: [
              {
                id: "notes",
                label: "Notes",
                isContainer: true,
                navigationIntent: { id: "page", payload: "notes" },
                children: [{ id: "note", label: "First note", navigationIntent: { id: "resource", payload: "note" } }],
              },
            ],
          },
        ]}
        expandedNodeIds={expanded}
        onToggleNode={(id) =>
          setExpanded((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]))
        }
        onNavigate={({ node }) => setOpened(String(node.label))}
      />
      <Text role="status">{opened}</Text>
    </Stack>
  );
};
const meta = {
  title: "Components/Data Display/Tree List/Branch navigation",
  component: NavigableBranch,
} satisfies CanvasMeta<typeof NavigableBranch>;
export default meta;
export const PageAndChildren: CanvasVariant<typeof meta> = {
  id: "components-data-display-tree-list-branch-navigation--page-and-children",
};
