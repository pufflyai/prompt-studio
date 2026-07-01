import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { GitBranch, Plus } from "lucide-react";
import { EmptyState } from "@/components/primitives/empty-state";
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

const rowSections: TreeListSection[] = [
  {
    id: "files",
    label: "Files",
    actions: [{ id: "new-file", label: "New file", icon: <Plus size={14} /> }],
    nodes: [{ id: "files-empty", label: "No files", disabled: true, rowVariant: "empty-state" }],
  },
  {
    id: "workspaces",
    label: "Workspaces",
    actions: [{ id: "new-workspace", label: "New workspace", icon: <Plus size={14} /> }],
    nodes: [{ id: "workspaces-empty", label: "No workspaces", disabled: true, rowVariant: "empty-state" }],
  },
];

export const ExpandedSection: Story = {
  render: () => (
    <Box maxW="20rem" borderWidth="1px" p="xs">
      <TreeList
        sections={sections}
        expandedSectionIds={["workspaces"]}
        rowVariant="compact"
        sectionGap="md"
        nodeGap="1px"
      />
    </Box>
  ),
};

export const PlaceholderRows: Story = {
  render: () => (
    <Box maxW="20rem" borderWidth="1px" p="xs">
      <TreeList
        sections={rowSections}
        expandedSectionIds={["files", "workspaces"]}
        rowVariant="compact"
        nodeGap="1px"
      />
    </Box>
  ),
};
