import { Box, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { HelpCircle, Plus } from "lucide-react";
import { useState } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
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
const meta = { title: "Components/Tree List/Menu rows", component: MenuTree } satisfies Meta<typeof MenuTree>;
export default meta;
export const MenuAndBranch: StoryObj<typeof meta> = {};

export const FooterMenu: StoryObj<typeof meta> = {
  render: () => (
    <Box h="20rem" display="flex" alignItems="flex-end" p="md">
      <TreeList
        sections={[]}
        footerSections={[
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
  ),
  play: async ({ canvasElement }) => {
    const help = within(canvasElement).getByRole("button", { name: "Help", exact: true });
    await userEvent.click(help);
    const menu = await screen.findByRole("menu");
    await waitFor(() => {
      const anchor = help.getBoundingClientRect();
      const bounds = menu.getBoundingClientRect();
      expect(Math.abs(bounds.left - anchor.left)).toBeLessThan(12);
      expect(Math.abs(bounds.bottom - anchor.top)).toBeLessThan(20);
    });
    await userEvent.keyboard("{Escape}");
    help.focus();
    await userEvent.keyboard("{Enter}");
    await expect(await screen.findByRole("menuitem", { name: "Documentation" })).toBeVisible();
    await userEvent.keyboard("{Escape}");
  },
};
