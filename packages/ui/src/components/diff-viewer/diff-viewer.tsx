import { Box, Flex, HStack, Skeleton, Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { ResizableSplitLayout } from "@/components/layout/resizable-split-layout";
import { EmptyState } from "@/components/primitives/empty-state";
import { buildChangedFilesTree, collectExpandedFolderIds, sortPathsByViewMode } from "./build-changed-files-tree";
import { DiffBubble } from "./diff-bubble";
import type { Diff } from "./diff-card";
import { DiffDrawer, type DiffDrawerExpansionState, type DiffExpansionCommand } from "./diff-drawer";
import { useDiffViewerStore } from "./diff-viewer.store";
import { DiffViewerOptionsMenu } from "./diff-viewer-options-menu";
import { FileListPanel } from "./file-list-panel";
import type { ChangedFilesViewMode, FileIconInfo } from "./types";

export interface DiffViewerProps {
  diffs: Diff[];
  changedFilePaths?: string[];
  defaultSelectedPath?: string | null;
  loading?: boolean;
  onLoadDiff?: (path: string) => Promise<void>;
  resolveFileIcon?: (path: string, options?: { isFolder?: boolean; isExpanded?: boolean }) => FileIconInfo | undefined;
}

const getDiffPath = (diff: Diff) => diff.newPath ?? diff.oldPath ?? "unknown";
const buildChangeByPath = (diffs: Diff[]) => new Map(diffs.map((diff) => [getDiffPath(diff), diff.change]));
const sumDiffStats = (diffs: Diff[]) =>
  diffs.reduce(
    (total, diff) => ({
      additions: total.additions + (diff.additions ?? 0),
      deletions: total.deletions + (diff.deletions ?? 0),
    }),
    { additions: 0, deletions: 0 },
  );

const buildFilteredDiffs = (input: {
  diffs: Diff[];
  normalizedSearchQuery: string;
  viewMode: ChangedFilesViewMode;
}) => {
  const { diffs, normalizedSearchQuery, viewMode } = input;
  const matchingDiffs = normalizedSearchQuery
    ? diffs.filter((diff) => getDiffPath(diff).toLowerCase().includes(normalizedSearchQuery))
    : diffs;
  const orderedPaths = sortPathsByViewMode(matchingDiffs.map(getDiffPath), viewMode);
  const orderByPath = new Map(orderedPaths.map((path, index) => [path, index]));

  return [...matchingDiffs].sort((left, right) => {
    const leftOrder = orderByPath.get(getDiffPath(left)) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = orderByPath.get(getDiffPath(right)) ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });
};

const resolveSelectedPath = (preferredPaths: string[], fallbackPaths: string[]) =>
  preferredPaths[0] ?? fallbackPaths[0] ?? null;

const loadingDiffItems = ["first", "second", "third"] as const;

const DiffViewerLoading = () => (
  <Stack flex="1" minH="0" bg="bg" p="xs" gap="xs" role="status" aria-busy="true" aria-label="Loading diff panel">
    {loadingDiffItems.map((item) => (
      <Skeleton key={item} h="72px" w="full" flexShrink="0" borderRadius="xs" />
    ))}
  </Stack>
);

export const DiffViewer = (props: DiffViewerProps) => {
  const { diffs, changedFilePaths, defaultSelectedPath = null, loading = false, onLoadDiff, resolveFileIcon } = props;
  const [diffExpansionCommand, setDiffExpansionCommand] = useState<DiffExpansionCommand | null>(null);
  const [diffExpansionState, setDiffExpansionState] = useState<DiffDrawerExpansionState>({
    allExpanded: false,
    allCollapsed: false,
  });
  const {
    isTreePanelOpen,
    viewMode,
    diffViewMode,
    searchQuery,
    selectedPath,
    expandedFolderIds,
    setTreePanelOpen,
    setViewMode,
    setDiffViewMode,
    setSearchQuery,
    setSelectedPath,
    setExpandedFolderIds,
    toggleFolder,
    expandAll,
    collapseAll,
  } = useDiffViewerStore();

  const diffPaths = diffs.map(getDiffPath);
  const filePaths = changedFilePaths ?? diffPaths;
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredFilePaths = normalizedSearchQuery
    ? filePaths.filter((path) => path.toLowerCase().includes(normalizedSearchQuery))
    : filePaths;
  const filteredDiffs = buildFilteredDiffs({ diffs, normalizedSearchQuery, viewMode });
  const changeByPath = buildChangeByPath(diffs);
  const filteredDiffPaths = filteredDiffs.map(getDiffPath);
  const fileTree = buildChangedFilesTree(filteredFilePaths, viewMode);
  const folderIds = viewMode === "nested" ? collectExpandedFolderIds(fileTree) : [];
  const filteredFilePathKey = filteredFilePaths.join("\0");
  const filteredDiffPathKey = filteredDiffPaths.join("\0");
  const resolvedSelectedPath =
    selectedPath ?? defaultSelectedPath ?? resolveSelectedPath(filteredDiffPaths, filteredFilePaths);
  const hasDiffs = filteredDiffs.length > 0;
  const emptyDiffTitle = normalizedSearchQuery ? "No matching diffs" : "No changes";
  const showDiffEmptyState = !loading && !hasDiffs;
  const totalDiff = sumDiffStats(filteredDiffs);
  const hasExpandableItems = folderIds.length > 0 || filteredDiffs.length > 0;
  const allFilesExpanded = folderIds.every((folderId) => expandedFolderIds.has(folderId));
  const allFilesCollapsed = folderIds.every((folderId) => !expandedFolderIds.has(folderId));
  const allDiffsExpanded = filteredDiffs.length === 0 || diffExpansionState.allExpanded;
  const allDiffsCollapsed = filteredDiffs.length === 0 || diffExpansionState.allCollapsed;
  const isExpandAllDisabled = !hasExpandableItems || (allFilesExpanded && allDiffsExpanded);
  const isCollapseAllDisabled = !hasExpandableItems || (allFilesCollapsed && allDiffsCollapsed);

  useEffect(() => {
    const filePaths = filteredFilePathKey ? filteredFilePathKey.split("\0") : [];
    const tree = buildChangedFilesTree(filePaths, viewMode);
    setExpandedFolderIds(viewMode === "nested" ? collectExpandedFolderIds(tree) : []);
  }, [filteredFilePathKey, setExpandedFolderIds, viewMode]);

  useEffect(() => {
    const diffPaths = filteredDiffPathKey ? filteredDiffPathKey.split("\0") : [];
    const filePaths = filteredFilePathKey ? filteredFilePathKey.split("\0") : [];
    if (resolvedSelectedPath && diffPaths.includes(resolvedSelectedPath)) return;
    setSelectedPath(resolveSelectedPath(diffPaths, filePaths));
  }, [filteredDiffPathKey, filteredFilePathKey, resolvedSelectedPath, setSelectedPath]);

  const expandAllFilesAndDiffs = () => {
    expandAll(folderIds);
    setDiffExpansionCommand((current) => ({ action: "expand", id: (current?.id ?? 0) + 1 }));
  };

  const collapseAllFilesAndDiffs = () => {
    collapseAll();
    setDiffExpansionCommand((current) => ({ action: "collapse", id: (current?.id ?? 0) + 1 }));
  };

  const selectChangedFilePath = (path: string) => {
    const currentIndex = resolvedSelectedPath ? filteredDiffPaths.indexOf(resolvedSelectedPath) : -1;
    const nextIndex = filteredDiffPaths.indexOf(path);
    const direction = currentIndex >= 0 && nextIndex >= 0 && nextIndex < currentIndex ? "up" : "down";

    setSelectedPath(path);
    setDiffExpansionCommand((current) => ({ action: "expand-selected", direction, id: (current?.id ?? 0) + 1, path }));
  };

  const diffPanel = (
    <Stack h="full" minH="0" minW="0" flex="1" bg="bg" gap="0">
      <Header variant="main" borderBottomWidth="1px" borderColor="border.subtle" bg="bg" justifyContent="space-between">
        <HStack gap="xs" minW="0">
          <DiffViewerOptionsMenu
            isTreePanelOpen={isTreePanelOpen}
            hasFilePaths={filePaths.length > 0}
            viewMode={viewMode}
            diffViewMode={diffViewMode}
            isExpandAllDisabled={isExpandAllDisabled}
            isCollapseAllDisabled={isCollapseAllDisabled}
            onToggleTreePanel={() => setTreePanelOpen(!isTreePanelOpen)}
            onViewModeChange={setViewMode}
            onDiffViewModeChange={setDiffViewMode}
            onExpandAll={expandAllFilesAndDiffs}
            onCollapseAll={collapseAllFilesAndDiffs}
          />
          {showDiffEmptyState ? (
            <Text textStyle="label/S/regular" color="fg.muted" truncate>
              {emptyDiffTitle}
            </Text>
          ) : null}
        </HStack>
        <DiffBubble variant="ghost" size="small" additions={totalDiff.additions} deletions={totalDiff.deletions} />
      </Header>
      {loading ? (
        <DiffViewerLoading />
      ) : hasDiffs ? (
        <Box flex="1" minH="0">
          <DiffDrawer
            diffs={filteredDiffs}
            selectedDiffPath={resolvedSelectedPath}
            onLoadDiff={onLoadDiff}
            onSelectDiffPath={setSelectedPath}
            onExpansionStateChange={setDiffExpansionState}
            expansionCommand={diffExpansionCommand}
            diffViewMode={diffViewMode}
          />
        </Box>
      ) : (
        <Box flex="1" minH="0" px="md" py="lg" display="flex" alignItems="center" justifyContent="center" bg="bg">
          <EmptyState title={emptyDiffTitle} />
        </Box>
      )}
    </Stack>
  );

  return (
    <Flex flex="1" minH="0" minW="0" bg="bg" gap="0" data-testid="diff-viewer">
      <ResizableSplitLayout
        flex="1"
        minH="0"
        minW="0"
        resizablePanel={
          <FileListPanel
            title="Changed files"
            paths={filteredFilePaths}
            selectedPath={resolvedSelectedPath}
            viewMode={viewMode}
            searchQuery={searchQuery}
            expandedFolderIds={expandedFolderIds}
            onSelectPath={selectChangedFilePath}
            onSearchQueryChange={setSearchQuery}
            onToggleFolder={toggleFolder}
            resolveFileIcon={resolveFileIcon}
            changeByPath={changeByPath}
          />
        }
        contentPanel={diffPanel}
        collapsed={!isTreePanelOpen}
        defaultSizePx={288}
        minSizePx={224}
        contentMinSizePx={320}
        resizeLabel="Resize file list panel"
        onCollapsedChange={(collapsed) => setTreePanelOpen(!collapsed)}
      />
    </Flex>
  );
};
