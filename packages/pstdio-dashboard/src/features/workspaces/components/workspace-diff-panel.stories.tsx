import { Box, Flex } from "@chakra-ui/react";
import type { Diff } from "@pstdio/ui";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import type { ApiFileDiff, ApiWorkspaceArtifact } from "@/features/ticket-list/data/api/types";
import { WorkspaceDiffPanel } from "./workspace-diff-panel";

const sampleChangedFiles: ApiFileDiff[] = [
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

const sampleArtifacts: ApiWorkspaceArtifact[] = [
  {
    id: "artifact-1",
    file_id: "file-1",
    file_name: "validation.log",
    file_kind: "artifact",
    relative_path: "artifacts/validation.log",
    mime_type: "text/plain",
    size_bytes: 128,
    created_at: "2026-04-09T00:00:00.000Z",
  },
];

const edgeCaseArtifacts: ApiWorkspaceArtifact[] = [
  {
    id: "artifact-2",
    file_id: "file-2",
    file_name: "readme",
    file_kind: "artifact",
    relative_path: "artifacts/v1.2/readme",
    mime_type: "text/plain",
    size_bytes: 88,
    created_at: "2026-04-09T00:00:00.000Z",
  },
  {
    id: "artifact-3",
    file_id: "file-3",
    file_name: ".env",
    file_kind: "artifact",
    relative_path: "artifacts/.env",
    mime_type: "text/plain",
    size_bytes: 32,
    created_at: "2026-04-09T00:00:00.000Z",
  },
  {
    id: "artifact-4",
    file_id: "file-4",
    file_name: "archive.tar.gz",
    file_kind: "artifact",
    relative_path: "artifacts/archive.tar.gz",
    mime_type: "application/gzip",
    size_bytes: 512,
    created_at: "2026-04-09T00:00:00.000Z",
  },
];

const meta = {
  title: "Workspaces/WorkspaceDiffPanel",
  component: WorkspaceDiffPanel,
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
} satisfies Meta<typeof WorkspaceDiffPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithDiffs: Story = {
  args: {
    diffs: sampleDiffs,
    artifacts: sampleArtifacts,
    changedFiles: sampleChangedFiles,
  },
};

export const Empty: Story = {
  args: {
    diffs: [],
    artifacts: [],
    changedFiles: [],
  },
};

export const ArtifactsOnly: Story = {
  args: {
    diffs: [],
    artifacts: sampleArtifacts,
    changedFiles: [],
  },
};

export const ArtifactsOnlyEdgeCases: Story = {
  args: {
    diffs: [],
    artifacts: edgeCaseArtifacts,
    changedFiles: [],
  },
};

export const Loading: Story = {
  args: {
    diffs: [],
    artifacts: [],
    changedFiles: [],
    loading: true,
  },
};
