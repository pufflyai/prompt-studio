import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { GitBranch } from "lucide-react";
import { EmptyState } from "../empty-state";
import { TreeList } from "./tree-list";
import type { TreeListSection } from "./tree-list.types";

const meta: Meta<typeof TreeList> = {
  title: "Components/Data Display/Tree List/Empty State",
  component: TreeList,
};

export default meta;
type Story = StoryObj<typeof TreeList>;

const sections: TreeListSection[] = [
  {
    id: "workspaces",
    label: "Workspaces",
    emptyState: (
      <EmptyState
        title="No workspaces"
        description="Create a workspace to start implementation."
        icon={<GitBranch size={16} />}
        size="sm"
        px="sm"
        py="md"
        minH="6rem"
      />
    ),
    nodes: [],
  },
];

export const ExpandedSection: Story = {
  render: () => (
    <Box maxW="20rem" borderWidth="1px" p="xs">
      <TreeList sections={sections} expandedSectionIds={["workspaces"]} rowVariant="compact" sectionGap="md" />
    </Box>
  ),
};
