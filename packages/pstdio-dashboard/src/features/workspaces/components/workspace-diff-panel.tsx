import { Box, Button, Flex, Skeleton, Stack, Tabs } from "@chakra-ui/react";
import { type Diff, DiffDrawer, EmptyState } from "@pstdio/ui";
import { FileDiffIcon, ListTree, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ApiFileDiff, ApiWorkspaceArtifact } from "@/features/ticket-list/data/api/types";
import { normalizeWorkspacePageTab, type WorkspacePageTab } from "@/features/workspaces/pages/workspace-page-tab";
import { type ChangedFilesViewMode, collectChangedFilePaths } from "../utils/build-changed-files-tree";
import { WorkspaceChecksPanel } from "./workspace-checks-panel";
import { FileListPanel, ResizableLeftPanel, resolveSelectedPath } from "./workspace-file-list-panel";

interface WorkspaceDiffPanelProps {
  ticketId: string;
  diffs: Diff[];
  artifacts: ApiWorkspaceArtifact[];
  changedFiles: ApiFileDiff[];
  activeTab: WorkspacePageTab;
  onTabChange: (tab: WorkspacePageTab) => void;
  loading?: boolean;
}

const WorkspaceDiffPanelLoading = () => (
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

export const WorkspaceDiffPanel = (props: WorkspaceDiffPanelProps) => {
  const { ticketId, diffs, artifacts, changedFiles, activeTab, onTabChange, loading = false } = props;
  const { t } = useTranslation("tickets");
  const [isTreePanelOpen, setTreePanelOpen] = useState(true);
  const [viewMode, setViewMode] = useState<ChangedFilesViewMode>("nested");
  const [searchQuery, setSearchQuery] = useState("");
  const diffPaths = useMemo(() => diffs.map((diff) => diff.newPath ?? diff.oldPath ?? "unknown"), [diffs]);
  const changedFilePaths = useMemo(() => collectChangedFilePaths(changedFiles), [changedFiles]);
  const [selectedDiffPath, setSelectedDiffPath] = useState<string | null>(() =>
    resolveSelectedPath(diffPaths, changedFilePaths),
  );
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredChangedFilePaths = useMemo(() => {
    if (!normalizedSearchQuery) return changedFilePaths;

    return changedFilePaths.filter((path) => path.toLowerCase().includes(normalizedSearchQuery));
  }, [changedFilePaths, normalizedSearchQuery]);
  const filteredDiffs = useMemo(() => {
    if (!normalizedSearchQuery) return diffs;

    return diffs.filter((diff) => (diff.newPath ?? diff.oldPath ?? "").toLowerCase().includes(normalizedSearchQuery));
  }, [diffs, normalizedSearchQuery]);
  const filteredDiffPaths = useMemo(
    () => filteredDiffs.map((diff) => diff.newPath ?? diff.oldPath ?? "unknown"),
    [filteredDiffs],
  );
  const hasDiffs = filteredDiffs.length > 0;
  const hasChangedFiles = changedFiles.length > 0;

  useEffect(() => {
    if (selectedDiffPath && filteredDiffPaths.includes(selectedDiffPath)) return;

    setSelectedDiffPath(resolveSelectedPath(filteredDiffPaths, filteredChangedFilePaths));
  }, [filteredChangedFilePaths, filteredDiffPaths, selectedDiffPath]);

  if (loading) {
    return <WorkspaceDiffPanelLoading />;
  }

  const resolvedSelectedDiffPath = selectedDiffPath ?? resolveSelectedPath(filteredDiffPaths, filteredChangedFilePaths);
  const handleSelectDiffPath = (path: string) => {
    setSelectedDiffPath(path);
  };

  return (
    <Flex h="full" minH="0" minW="0" flex="1" bg="bg.subtle" gap="0" data-testid="workspace-diff-panel">
      <Tabs.Root
        value={activeTab}
        onValueChange={(details) => onTabChange(normalizeWorkspacePageTab(details.value))}
        variant="enclosed"
        display="flex"
        flexDirection="column"
        h="full"
        minH="0"
        minW="0"
        flex="1"
        bg="bg.subtle"
        size="sm"
      >
        <Tabs.List h="41px" minH="41px" bg="bg.subtle" borderBottomWidth="1px" borderRadius={0} px="xs" py="1px">
          <Tabs.Trigger value="changes" gap="2xs">
            <FileDiffIcon size={14} />
            {t("workspaceDiffPanel.tabs.changes")}
          </Tabs.Trigger>
          <Tabs.Trigger value="checks" gap="2xs">
            <ShieldCheck size={14} />
            {t("workspaceDiffPanel.tabs.checks")}
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="changes" flex="1" minH="0" minW="0" p="0" display="flex">
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
        </Tabs.Content>

        <Tabs.Content value="checks" flex="1" minH="0" minW="0" p="0" display="flex">
          <WorkspaceChecksPanel ticketId={ticketId} artifacts={artifacts} />
        </Tabs.Content>
      </Tabs.Root>
    </Flex>
  );
};
