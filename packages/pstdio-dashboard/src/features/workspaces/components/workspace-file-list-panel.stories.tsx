import { Box, Flex } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { AlertCircle, CheckCircle2, FileText } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { ChangedFilesViewMode } from "../utils/build-changed-files-tree";
import { FileListPanel } from "./workspace-file-list-panel";

const longPaths = [
  "packages/pstdio-dashboard/src/features/workspaces/components/workspace-file-list-panel.tsx",
  "packages/pstdio-dashboard/src/features/workspaces/utils/build-changed-files-tree.ts",
  "packages/pstdio-dashboard/src/features/ticket-list/data/api/types-with-a-very-long-identifier-name.ts",
  "README.md",
];

const artifactPaths = [
  "checks/lint/passed.log",
  "checks/tests/failed-spec.json",
  "checks/validate/ok.txt",
  "checks/build/error.log",
];

type StoryFn = () => ReactNode;

interface HarnessProps {
  title: string;
  initialViewMode: ChangedFilesViewMode;
  paths: string[];
  resolveFileIcon?: (path: string) => { icon: ReactNode; color: string };
}

const FileListPanelHarness = (props: HarnessProps) => {
  const [viewMode, setViewMode] = useState<ChangedFilesViewMode>(props.initialViewMode);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  return (
    <FileListPanel
      title={props.title}
      paths={props.paths}
      selectedPath={selectedPath}
      onSelectPath={setSelectedPath}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      resolveFileIcon={props.resolveFileIcon}
    />
  );
};

const resolveArtifactIcon = (path: string) => {
  if (path.includes("fail") || path.includes("error")) return { icon: <AlertCircle size={14} />, color: "fg.error" };
  if (path.includes("pass") || path.includes("ok")) return { icon: <CheckCircle2 size={14} />, color: "fg.success" };
  return { icon: <FileText size={14} />, color: "fg.subtle" };
};

const meta = {
  title: "Workspaces/FileListPanel",
  component: FileListPanelHarness,
  decorators: [
    (Story: StoryFn) => (
      <Flex height="75vh" border="1px solid" borderColor="border.muted" borderRadius="md" overflow="hidden">
        <Box w="288px" h="full">
          <Story />
        </Box>
        <Box flex="1" bg="bg.canvas" />
      </Flex>
    ),
  ],
} satisfies Meta<typeof FileListPanelHarness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FlatChangedFiles: Story = {
  args: {
    title: "Changed files",
    initialViewMode: "flat",
    paths: longPaths,
  },
};

export const NestedChangedFiles: Story = {
  args: {
    title: "Changed files",
    initialViewMode: "nested",
    paths: longPaths,
  },
};

export const NestedArtifactsWithStatusIcons: Story = {
  args: {
    title: "Artifacts",
    initialViewMode: "nested",
    paths: artifactPaths,
    resolveFileIcon: resolveArtifactIcon,
  },
};
