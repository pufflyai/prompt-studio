import { Box, Button, HStack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { FolderGit2, GitBranch, GitCommitHorizontal } from "lucide-react";
import { MenuItem } from "./menu-item";
import { SearchableMenu } from "./searchable-menu";

const branchItems = Array.from({ length: 18 }, (_, index) => {
  const branchName = index === 0 ? "main" : `feature/searchable-menu-${index}`;

  return {
    id: branchName,
    label: branchName,
    searchText: `origin/${branchName}`,
    icon: GitBranch,
    isSelected: branchName === "main",
  };
});

const meta: Meta<typeof SearchableMenu> = {
  title: "Navigation/SearchableMenu",
  component: SearchableMenu,
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <Box maxWidth="320px">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SearchableMenu>;

export const BranchSelector: Story = {
  render: () => (
    <SearchableMenu
      trigger={<Button variant="outline">Select branch</Button>}
      items={branchItems}
      searchPlaceholder="Search branches…"
      header={
        <HStack justify="space-between" alignItems="center" px="sm" py="xs">
          <HStack gap="xs" color="fg.muted">
            <FolderGit2 size={14} />
            <Text textStyle="label/XS/medium">prompt-studio</Text>
          </HStack>
          <GitCommitHorizontal size={14} />
        </HStack>
      }
      emptyState={<MenuItem primaryLabel="No branches found" leftIcon={GitBranch} isDisabled />}
      renderItem={(item) => (
        <MenuItem id={item.id} primaryLabel={item.label} leftIcon={item.icon} isSelected={item.isSelected} />
      )}
    />
  ),
};
