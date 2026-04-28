import { Box, Button, Flex, Skeleton, Stack } from "@chakra-ui/react";
import { type Diff, DiffDrawer, EmptyState } from "@pstdio/ui";
import { ListTree } from "lucide-react";
import type { WorkspaceFileDiff } from "pstdio-api-contracts";
import { useEffect, useState } from "react";
import { type ChangedFilesViewMode, collectChangedFilePaths } from "../utils/build-changed-files-tree";
import { sortDiffs } from "../utils/sort-diffs";
import { FileListPanel, ResizableLeftPanel, resolveSelectedPath } from "./workspace-file-list-panel";

interface WorkspaceChangesPanelProps {
  diffs: Diff[];
  changedFiles: WorkspaceFileDiff[];
  loading?: boolean;
}

export const buildFilteredDiffs = (input: {
  diffs: Diff[];
  normalizedSearchQuery: string;
  viewMode: ChangedFilesViewMode;
}) => {
  const { diffs, normalizedSearchQuery, viewMode } = input;
  const matchingDiffs = normalizedSearchQuery
    ? diffs.filter((diff) => (diff.newPath ?? diff.oldPath ?? "").toLowerCase().includes(normalizedSearchQuery))
    : diffs;

  return sortDiffs(matchingDiffs, viewMode);
};

const WorkspaceChangesPanelLoading = () => (
  <Flex h="full" minH="0" minW="0" flex="1" bg="bg.subtle" gap="0">
    <Stack w="18rem" minW="18rem" h="full" gap="0" borderRightWidth="1px" bg="bg">
      <Skeleton height="41px" borderRadius="0" />
      <Stack gap="xs" px="sm" py="sm">
        <Skeleton height="28px" borderRadius="sm" />
        <Skeleton height="18px" borderRadius="sm" />
        <Skeleton height="18px" borderRadius="sm" />
        <Skeleton height="18px" borderRadius="sm" />
      </Stack>
    </Stack>

    <Stack flex="1" minH="0" gap="0">
      <Skeleton height="41px" borderRadius="0" />
      <Stack gap="xs" px="sm" py="sm">
        <Skeleton height="22px" borderRadius="sm" />
        <Skeleton height="110px" borderRadius="sm" />
        <Skeleton height="110px" borderRadius="sm" />
      </Stack>
    </Stack>
  </Flex>
);

interface WorkspaceDiffHeaderProps {
  hasChangedFiles: boolean;
  onToggleTreePanel: () => void;
  isTreePanelOpen: boolean;
}

const WorkspaceDiffHeader = (props: WorkspaceDiffHeaderProps) => {
  const { hasChangedFiles, onToggleTreePanel, isTreePanelOpen } = props;

  return (
    <Flex h="41px" minH="41px" align="center" px="sm" borderBottomWidth="1px" bg="bg">
      {hasChangedFiles ? (
        <Button size="sm" variant="ghost" gap="2xs" onClick={onToggleTreePanel}>
          <ListTree size={14} />
          {isTreePanelOpen ? "Hide file tree" : "Show file tree"}
        </Button>
      ) : null}
    </Flex>
  );
};

export const WorkspaceChangesPanel = (props: WorkspaceChangesPanelProps) => {
  const { diffs, changedFiles, loading = false } = props;
  const [isTreePanelOpen, setTreePanelOpen] = useState(true);
  const [viewMode, setViewMode] = useState<ChangedFilesViewMode>("nested");
  const [searchQuery, setSearchQuery] = useState("");
  const diffPaths = diffs.map((diff) => diff.newPath ?? diff.oldPath ?? "unknown");
  const changedFilePaths = collectChangedFilePaths(changedFiles);
  const [selectedDiffPath, setSelectedDiffPath] = useState<string | null>(() =>
    resolveSelectedPath(diffPaths, changedFilePaths),
  );
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredChangedFilePaths = !normalizedSearchQuery
    ? changedFilePaths
    : changedFilePaths.filter((path) => path.toLowerCase().includes(normalizedSearchQuery));
  const filteredDiffs = buildFilteredDiffs({ diffs, normalizedSearchQuery, viewMode });
  const filteredDiffPaths = filteredDiffs.map((diff) => diff.newPath ?? diff.oldPath ?? "unknown");
  const hasDiffs = filteredDiffs.length > 0;
  const hasChangedFiles = changedFiles.length > 0;

  useEffect(() => {
    if (selectedDiffPath && filteredDiffPaths.includes(selectedDiffPath)) return;

    setSelectedDiffPath(resolveSelectedPath(filteredDiffPaths, filteredChangedFilePaths));
  }, [filteredChangedFilePaths, filteredDiffPaths, selectedDiffPath]);

  if (loading) {
    return <WorkspaceChangesPanelLoading />;
  }

  const resolvedSelectedDiffPath = selectedDiffPath ?? resolveSelectedPath(filteredDiffPaths, filteredChangedFilePaths);
  const handleSelectDiffPath = (path: string) => {
    setSelectedDiffPath(path);
  };

  return (
    <Flex h="full" minH="0" minW="0" flex="1" bg="bg.subtle" gap="0" data-testid="workspace-diff-panel">
      <Flex flex="1" minH="0" minW="0" bg="bg.subtle" gap="0">
        {hasChangedFiles && isTreePanelOpen ? (
          <ResizableLeftPanel>
            <FileListPanel
              title="Changed files"
              paths={filteredChangedFilePaths}
              selectedPath={resolvedSelectedDiffPath}
              onSelectPath={handleSelectDiffPath}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
            />
          </ResizableLeftPanel>
        ) : null}

        <Stack h="full" minH="0" minW="0" flex="1" bg="bg.subtle" gap="0">
          <WorkspaceDiffHeader
            hasChangedFiles={hasChangedFiles}
            onToggleTreePanel={() => setTreePanelOpen((open) => !open)}
            isTreePanelOpen={isTreePanelOpen}
          />

          {hasDiffs ? (
            <Box flex="1" minH="0">
              <DiffDrawer diffs={filteredDiffs} selectedDiffPath={resolvedSelectedDiffPath} />
            </Box>
          ) : (
            <Box flex="1" minH="0" px="md" py="lg" display="flex" alignItems="center" justifyContent="center">
              <EmptyState
                title="No diffs yet"
                description="Changes in this workspace will appear here once files are modified."
                data-testid="workspace-diff-panel-empty"
              />
            </Box>
          )}
        </Stack>
      </Flex>
    </Flex>
  );
};
