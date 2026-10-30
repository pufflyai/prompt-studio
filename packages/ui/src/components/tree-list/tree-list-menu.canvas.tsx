import { Box, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { HelpCircle, Plus } from "lucide-react";
import { useState } from "react";
import { TreeList } from "./tree-list";

const MenuTree = () => {
  const [selected, setSelected] = useState("Choose Help with the pointer or keyboard.");
  const [expandedNodeIds, setExpandedNodeIds] = useState<string[]>([]);
  const menuItems = [{ id: "docs", label: "Documentation", onAction: () => setSelected("Documentation selected") }];
  return (
    <Box w="full">
      <TreeList
        expandedNodeIds={expandedNodeIds}
        onToggleNode={(id) =>
          setExpandedNodeIds((ids) => (ids.includes(id) ? ids.filter((key) => key !== id) : [...ids, id]))
        }
        sections={[
          {
            id: "navigation",
            nodes: [
              { id: "help", label: "Help", icon: <HelpCircle />, menuItems, contextMenuItems: menuItems },
              {
                id: "folder",
                label: "Folder",
                children: [{ id: "child", label: "Child" }],
                actions: [
                  { id: "add", label: "Add item", icon: <Plus />, onAction: () => setSelected("Add item selected") },
                ],
              },
            ],
          },
        ]}
      />
      <Text>{selected}</Text>
    </Box>
  );
};
const meta = { title: "Components/Tree List/Menu rows", component: MenuTree } satisfies CanvasMeta<typeof MenuTree>;
export default meta;
export const MenuAndBranch: CanvasVariant<typeof meta> = {
  id: "components-tree-list-menu-rows--menu-and-branch",
};
export const FooterMenu: CanvasVariant<typeof meta> = {
  id: "components-tree-list-menu-rows--footer-menu",
  render: () => (
    <Box h="20rem" display="flex" alignItems="flex-end" p="md">
      <Box w="xs">
        <TreeList
          sections={[
            {
              id: "footer",
              nodes: [
                {
                  id: "help-footer",
                  label: "Help",
                  icon: <HelpCircle />,
                  menuPlacement: "top-start",
                  menuItems: [{ id: "docs", label: "Documentation" }],
                },
              ],
            },
          ]}
        />
      </Box>
    </Box>
  ),
};
