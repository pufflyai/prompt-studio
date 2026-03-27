import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Plus } from "lucide-react";
import { useState } from "react";
import { SidebarTree } from "./sidebar-tree";
import type { SidebarSection } from "./sidebar-tree.types";

const hookItems = Array.from({ length: 14 }, (_, index) => {
  const name = index === 0 ? "pre-commit" : `post-session-hook-${index}`;

  return {
    id: name,
    label: name,
    description: index === 0 ? "Before staging and committing" : "Session lifecycle hook",
  };
});

const meta: Meta<typeof SidebarTree> = {
  title: "Sidebar/SidebarTree/SearchableActionMenu",
  component: SidebarTree,
  parameters: {
    layout: "padded",
  },
};

export default meta;

type Story = StoryObj<typeof SidebarTree>;

export const HooksSection: Story = {
  render: () => {
    const [expandedSections, setExpandedSections] = useState<string[]>(["hooks"]);
    const sections: SidebarSection[] = [
      {
        id: "hooks",
        label: "Hooks",
        actions: [
          {
            id: "add-hook",
            label: "Add hook",
            icon: <Plus size={14} />,
            searchPlaceholder: "Search hooks…",
            emptyMenuLabel: "No hooks found",
            menuItems: hookItems,
          },
        ],
        nodes: [{ id: "pre-push", label: "pre-push", isNavigable: true }],
      },
    ];

    return (
      <Box w="280px" borderWidth="1px" borderColor="border.muted" borderRadius="md" overflow="hidden">
        <SidebarTree
          sections={sections}
          expandedSections={expandedSections}
          expandedNodes={[]}
          onToggleSection={(sectionId) =>
            setExpandedSections((current) =>
              current.includes(sectionId) ? current.filter((entry) => entry !== sectionId) : [...current, sectionId],
            )
          }
          onToggleNode={() => {}}
        />
      </Box>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Large action menus switch to the shared searchable menu with a scroll area.",
      },
    },
  },
};
