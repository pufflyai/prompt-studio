import { Box, Button, Flex, Skeleton, Stack, Tabs } from "@chakra-ui/react";
import { type Diff, DiffDrawer, EmptyState, Header, ResizableSplitLayout } from "@pstdio/ui";
import { FileDiffIcon, ListTree, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { normalizeWorkspacePageTab, type WorkspacePageTab } from "@/features/workspaces/pages/workspace-page-tab";
import type { ApiFileDiff, ApiWorkspaceArtifact } from "@/shared/api-types";
import { type ChangedFilesViewMode, collectChangedFilePaths } from "../utils/build-changed-files-tree";
import { sortDiffs } from "../utils/sort-diffs";
import { WorkspaceChecksPanel } from "./workspace-checks-panel";
import { FileListPanel, resolveSelectedPath } from "./workspace-file-list-panel";

interface WorkspaceDiffPanelProps {
  ticketId: string;
  workspaceId: string | null;
  diffs: Diff[];
  artifacts: ApiWorkspaceArtifact[];
  changedFiles: ApiFileDiff[];
  diffGeneration: number;
  activeTab: WorkspacePageTab;
  onTabChange: (tab: WorkspacePageTab) => void;
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

const getDiffPath = (diff: Diff) => diff.newPath ?? diff.oldPath ?? "unknown";

const WorkspaceDiffPanelLoading = () => (
  <Stack flex="1" minH="0" gap="0">
    <Skeleton height="41px" borderRadius="0" />
    <Stack gap="xs" px="sm" py="sm">
      <Skeleton height="22px" borderRadius="sm" />
      <Skeleton height="110px" borderRadius="sm" />
      <Skeleton height="110px" borderRadius="sm" />
    </Stack>
  </Stack>
);

interface WorkspaceDiffHeaderProps {
  hasChangedFiles: boolean;
  onToggleTreePanel: () => void;
  isTreePanelOpen: boolean;
}

const WorkspaceDiffHeader = (props: WorkspaceDiffHeaderProps) => {
  const { hasChangedFiles, onToggleTreePanel, isTreePanelOpen } = props;

  return (
    <Header variant="main" borderBottomWidth="1px" borderColor="border.muted" bg="bg">
      {hasChangedFiles ? (
        <Button size="sm" variant="ghost" gap="2xs" onClick={onToggleTreePanel}>
          <ListTree size={14} />
          {isTreePanelOpen ? "Hide file tree" : "Show file tree"}
        </Button>
      ) : null}
    </Header>
  );
};

export const WorkspaceDiffPanel = (props: WorkspaceDiffPanelProps) => {
  const { ticketId, diffs, artifacts, changedFiles, activeTab, onTabChange, loading = false } = props;
  const { t } = useTranslation("tickets");
  const [isTreePanelOpen, setTreePanelOpen] = useState(true);
  const [viewMode, setViewMode] = useState<ChangedFilesViewMode>("nested");
  const [searchQuery, setSearchQuery] = useState("");
  const diffPaths = diffs.map(getDiffPath);
  const changedFilePaths = collectChangedFilePaths(changedFiles);
  const [selectedDiffPath, setSelectedDiffPath] = useState<string | null>(() =>
    resolveSelectedPath(diffPaths, changedFilePaths),
  );
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredChangedFilePaths = !normalizedSearchQuery
    ? changedFilePaths
    : changedFilePaths.filter((path) => path.toLowerCase().includes(normalizedSearchQuery));
  const filteredDiffs = buildFilteredDiffs({ diffs, normalizedSearchQuery, viewMode });
  const filteredDiffPaths = filteredDiffs.map(getDiffPath);
  const hasDiffs = filteredDiffs.length > 0;
  const hasChangedFiles = changedFiles.length > 0;

  useEffect(() => {
    if (selectedDiffPath && filteredDiffPaths.includes(selectedDiffPath)) return;

    setSelectedDiffPath(resolveSelectedPath(filteredDiffPaths, filteredChangedFilePaths));
  }, [filteredChangedFilePaths, filteredDiffPaths, selectedDiffPath]);

  const resolvedSelectedDiffPath = selectedDiffPath ?? resolveSelectedPath(filteredDiffPaths, filteredChangedFilePaths);
  const handleSelectDiffPath = (path: string) => {
    setSelectedDiffPath(path);
  };
  const fileListPanel = (
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
  );
  const diffPanel = (
    <Stack h="full" minH="0" minW="0" flex="1" bg="bg.subtle" gap="0">
      <WorkspaceDiffHeader
        hasChangedFiles={hasChangedFiles}
        onToggleTreePanel={() => setTreePanelOpen((open) => !open)}
        isTreePanelOpen={isTreePanelOpen}
      />

      {loading ? (
        <WorkspaceDiffPanelLoading />
      ) : hasDiffs ? (
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
  );

  return (
    <Flex h="full" minH="0" minW="0" flex="1" bg="bg.subtle" gap="0" data-testid="workspace-diff-panel">
      <Tabs.Root
        value={activeTab}
        onValueChange={(details) => onTabChange(normalizeWorkspacePageTab(details.value))}
        variant="line"
        display="flex"
        flexDirection="column"
        h="full"
        minH="0"
        minW="0"
        flex="1"
        bg="bg.subtle"
        size="sm"
      >
        <Tabs.List bg="bg.subtle" borderBottomWidth="1px" borderColor="border.muted" px="xs">
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
            {hasChangedFiles ? (
              <ResizableSplitLayout
                flex="1"
                minH="0"
                minW="0"
                resizablePanel={fileListPanel}
                contentPanel={diffPanel}
                collapsed={!isTreePanelOpen}
                defaultSizePx={288}
                minSizePx={224}
                contentMinSizePx={320}
                resizeLabel="Resize file list panel"
                onCollapsedChange={(collapsed) => setTreePanelOpen(!collapsed)}
              />
            ) : (
              diffPanel
            )}
          </Flex>
        </Tabs.Content>

        <Tabs.Content value="checks" flex="1" minH="0" minW="0" p="0" display="flex">
          <WorkspaceChecksPanel ticketId={ticketId} artifacts={artifacts} />
        </Tabs.Content>
      </Tabs.Root>
    </Flex>
  );
};
