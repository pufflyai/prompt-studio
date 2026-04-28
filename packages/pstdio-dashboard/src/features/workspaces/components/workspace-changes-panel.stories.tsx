import { Box, Flex } from "@chakra-ui/react";
import { WorkspaceChangesPanel, type WorkspaceFileDiff } from "@pstdio/pstdio-ext-workspace-changes";
import type { Diff } from "@pstdio/ui";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";

const sampleChangedFiles: WorkspaceFileDiff[] = [
  {
    filePath: "src/workspace.ts",
    change: "modified",
    additions: 1,
    deletions: 1,
    oldContent: "export const panel = 'before';\n",
    newContent: "export const panel = 'after';\n",
  },
  {
    filePath: "src/features/sidebar.tsx",
    change: "added",
    additions: 42,
    deletions: 0,
    oldContent: "",
    newContent: "export const Sidebar = () => null;\n",
  },
];

type StoryFn = () => ReactNode;

const sampleDiffs: Diff[] = [
  {
    change: "modified",
    oldPath: "src/workspace.ts",
    newPath: "src/workspace.ts",
    oldContent: "export const panel = 'before';\n",
    newContent: "export const panel = 'after';\n",
    additions: 1,
    deletions: 1,
  },
];

const meta = {
  title: "Workspaces/WorkspaceChangesPanel",
  component: WorkspaceChangesPanel,
  decorators: [
    (Story: StoryFn) => (
      <Flex height="75vh" border="1px solid" borderColor="border.muted" borderRadius="md" overflow="hidden">
        <Box flex="1" bg="bg.canvas" />
        <Box w="420px" h="full">
          <Story />
        </Box>
      </Flex>
    ),
  ],
} satisfies Meta<typeof WorkspaceChangesPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithDiffs: Story = {
  args: {
    diffs: sampleDiffs,
    changedFiles: sampleChangedFiles,
  },
};

export const Empty: Story = {
  args: {
    diffs: [],
    changedFiles: [],
  },
};

export const Loading: Story = {
  args: {
    diffs: [],
    changedFiles: [],
    loading: true,
  },
};
