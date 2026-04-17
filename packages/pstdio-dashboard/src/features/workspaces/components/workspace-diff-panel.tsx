import { Box, Button, Flex, Skeleton, Stack } from "@chakra-ui/react";
import { type Diff, DiffDrawer, EmptyState } from "@pstdio/ui";
import { GitCompareArrows, ListTree, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ApiFileDiff, ApiWorkspaceArtifact } from "@/features/ticket-list/data/api/types";
import type { WorkspacePageTab } from "@/features/workspaces/pages/workspace-page-tab";
import type { ChangedFilesViewMode } from "../utils/build-changed-files-tree";
import { WorkspaceChecksPanel } from "./workspace-checks-panel";
import { ChangedFilesPanel, ResizableLeftPanel, resolveSelectedDiffPath } from "./workspace-diff-panel-changed-files";

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

interface WorkspacePanelTabsProps {
  activeTab: WorkspacePageTab;
  onTabChange: (tab: WorkspacePageTab) => void;
}

const WorkspacePanelTabs = (props: WorkspacePanelTabsProps) => {
  const { activeTab, onTabChange } = props;
  const { t } = useTranslation("tickets");

  return (
    <Flex h="41px" minH="41px" align="flex-end" px="sm" borderBottomWidth="1px" bg="bg">
      <Button
        size="sm"
        variant="ghost"
        borderRadius="0"
        borderBottomWidth="2px"
        borderColor={activeTab === "changes" ? "border.default" : "transparent"}
        color={activeTab === "changes" ? "foreground.primary" : "foreground.secondary"}
        gap="2xs"
        onClick={() => onTabChange("changes")}
      >
        <GitCompareArrows size={14} />
        {t("workspaceDiffPanel.tabs.changes")}
      </Button>

      <Button
        size="sm"
        variant="ghost"
        borderRadius="0"
        borderBottomWidth="2px"
        borderColor={activeTab === "checks" ? "border.default" : "transparent"}
        color={activeTab === "checks" ? "foreground.primary" : "foreground.secondary"}
        gap="2xs"
        onClick={() => onTabChange("checks")}
      >
        <ShieldCheck size={14} />
        {t("workspaceDiffPanel.tabs.checks")}
      </Button>
    </Flex>
  );
};

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
  const [isTreePanelOpen, setTreePanelOpen] = useState(true);
  const [viewMode, setViewMode] = useState<ChangedFilesViewMode>("nested");
  const [searchQuery, setSearchQuery] = useState("");
  const diffPaths = useMemo(() => diffs.map((diff) => diff.newPath ?? diff.oldPath ?? "unknown"), [diffs]);
  const [selectedDiffPath, setSelectedDiffPath] = useState<string | null>(() =>
    resolveSelectedDiffPath(diffPaths, changedFiles),
  );
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredChangedFiles = useMemo(() => {
    if (!normalizedSearchQuery) return changedFiles;

    return changedFiles.filter((file) =>
      (file.newPath ?? file.oldPath ?? file.filePath).toLowerCase().includes(normalizedSearchQuery),
    );
  }, [changedFiles, normalizedSearchQuery]);
  const filteredDiffs = useMemo(() => {
    if (!normalizedSearchQuery) return diffs;

    return diffs.filter((diff) => (diff.newPath ?? diff.oldPath ?? "").toLowerCase().includes(normalizedSearchQuery));
  }, [diffs, normalizedSearchQuery]);
  const hasDiffs = filteredDiffs.length > 0;
  const hasChangedFiles = changedFiles.length > 0;

  useEffect(() => {
    if (selectedDiffPath) {
      const pathStillExists = filteredDiffs.some(
        (diff) => (diff.newPath ?? diff.oldPath ?? "unknown") === selectedDiffPath,
      );
      if (pathStillExists) return;
    }

    setSelectedDiffPath(
      resolveSelectedDiffPath(
        filteredDiffs.map((diff) => diff.newPath ?? diff.oldPath ?? "unknown"),
        filteredChangedFiles,
      ),
    );
  }, [filteredChangedFiles, filteredDiffs, selectedDiffPath]);

  if (loading) {
    return <WorkspaceDiffPanelLoading />;
  }

  const resolvedSelectedDiffPath =
    selectedDiffPath ??
    resolveSelectedDiffPath(
      filteredDiffs.map((diff) => diff.newPath ?? diff.oldPath ?? "unknown"),
      filteredChangedFiles,
    );
  const handleSelectDiffPath = (path: string) => {
    setSelectedDiffPath(path);
  };

  return (
    <Flex h="full" minH="0" minW="0" flex="1" bg="bg.subtle" gap="0" data-testid="workspace-diff-panel">
      <Stack h="full" minH="0" minW="0" flex="1" bg="bg.subtle" gap="0">
        <WorkspacePanelTabs activeTab={activeTab} onTabChange={onTabChange} />

        {activeTab === "checks" ? (
          <WorkspaceChecksPanel ticketId={ticketId} artifacts={artifacts} />
        ) : (
          <Flex flex="1" minH="0" minW="0" bg="bg.subtle" gap="0">
            {hasChangedFiles && isTreePanelOpen ? (
              <ResizableLeftPanel>
                <ChangedFilesPanel
                  changedFiles={filteredChangedFiles}
                  selectedDiffPath={resolvedSelectedDiffPath}
                  onSelectDiffPath={handleSelectDiffPath}
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
        )}
      </Stack>
    </Flex>
  );
};
