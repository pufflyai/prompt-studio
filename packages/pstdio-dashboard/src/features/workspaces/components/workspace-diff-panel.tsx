import {
  Box,
  Button,
  createTreeCollection,
  Flex,
  HStack,
  Icon,
  IconButton,
  Input,
  Menu,
  Skeleton,
  Stack,
  Text,
  TreeView,
} from "@chakra-ui/react";
import { type Diff, DiffDrawer, EmptyState, MenuItem, ScrollArea } from "@pstdio/ui";
import { ChevronDown, ChevronRight, FileText, Folder, List, ListTree, PanelLeft } from "lucide-react";
import { type ReactNode, type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import type { ApiFileDiff, ApiWorkspaceArtifact } from "@/features/ticket-list/data/api/types";
import {
  buildChangedFilesTree,
  type ChangedFilesViewMode,
  type ChangedFileTreeNode,
  collectChangedFilePaths,
} from "../utils/build-changed-files-tree";

interface WorkspaceDiffPanelProps {
  diffs: Diff[];
  artifacts: ApiWorkspaceArtifact[];
  changedFiles: ApiFileDiff[];
  loading?: boolean;
}

const clampPanelWidth = (width: number, min: number, max: number) => Math.min(Math.max(width, min), max);

const ResizableLeftPanel = (props: { children: ReactNode }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const cleanupDragRef = useRef<() => void>(() => undefined);
  const [width, setWidth] = useState(288);

  useEffect(() => () => cleanupDragRef.current(), []);

  const handleResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panelRef.current) return;

    event.preventDefault();

    const panel = panelRef.current;
    const startX = event.clientX;
    const startWidth = panel.getBoundingClientRect().width;
    const minWidth = 224;
    const parentWidth = panel.parentElement?.getBoundingClientRect().width ?? window.innerWidth;
    const maxWidth = Math.max(minWidth, parentWidth - 320);
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      setWidth(clampPanelWidth(startWidth + (moveEvent.clientX - startX), minWidth, maxWidth));
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", cleanup);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      cleanupDragRef.current = () => undefined;
    };

    cleanupDragRef.current = cleanup;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", cleanup, { once: true });
  };

  return (
    <Flex
      ref={panelRef}
      direction="column"
      position="relative"
      flexShrink={0}
      w={`${width}px`}
      minW="14rem"
      h="100%"
      bg="bg"
      borderRightWidth="1px"
      overflow="hidden"
    >
      <Box
        role="separator"
        aria-label="Resize changed files panel"
        aria-orientation="vertical"
        position="absolute"
        top="0"
        bottom="0"
        right="0"
        width="3"
        transform="translateX(50%)"
        cursor="col-resize"
        touchAction="none"
        zIndex="1"
        onPointerDown={handleResizeStart}
      />
      {props.children}
    </Flex>
  );
};

const resolveArtifactLabel = (relativePath: string) => {
  const segments = relativePath.split("/");
  const fileName = segments.at(-1) ?? relativePath;
  const directory = segments.length > 1 ? `${segments.slice(0, -1).join("/")}/` : "";

  const extensionStart = fileName.startsWith(".") ? fileName.indexOf(".", 1) : fileName.lastIndexOf(".");
  const baseName = extensionStart > 0 ? fileName.slice(0, extensionStart) : fileName;

  return `${directory}${baseName}`;
};

const collectExpandedFolderIds = (nodes: ChangedFileTreeNode[]) => {
  const folderIds: string[] = [];

  const visit = (items: ChangedFileTreeNode[]) => {
    items.forEach((item) => {
      if (item.type !== "folder") return;
      folderIds.push(item.id);
      visit(item.children ?? []);
    });
  };

  visit(nodes);

  return folderIds;
};

const resolveSelectedDiffPath = (diffs: Diff[], changedFiles: ApiFileDiff[]) => {
  const firstDiffPath = diffs[0]?.newPath ?? diffs[0]?.oldPath ?? null;
  if (firstDiffPath) return firstDiffPath;

  return collectChangedFilePaths(changedFiles)[0] ?? null;
};

const getPathDepth = (nodeId: string) => {
  const path = nodeId.replace(/^(file|folder):/, "");
  const depth = path.split("/").length - 1;

  return Math.max(depth, 0);
};

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

interface ChangedFilesPanelProps {
  changedFiles: ApiFileDiff[];
  selectedDiffPath: string | null;
  onSelectDiffPath: (path: string) => void;
  viewMode: ChangedFilesViewMode;
  onViewModeChange: (mode: ChangedFilesViewMode) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
}

const ChangedFilesPanel = (props: ChangedFilesPanelProps) => {
  const {
    changedFiles,
    selectedDiffPath,
    onSelectDiffPath,
    viewMode,
    onViewModeChange,
    searchQuery,
    onSearchQueryChange,
  } = props;
  const changedFilePaths = useMemo(() => collectChangedFilePaths(changedFiles), [changedFiles]);
  const changedFileTree = useMemo(
    () => buildChangedFilesTree(changedFilePaths, viewMode),
    [changedFilePaths, viewMode],
  );
  const expandedFolders = useMemo(
    () => (viewMode === "nested" ? collectExpandedFolderIds(changedFileTree) : []),
    [changedFileTree, viewMode],
  );
  const collection = useMemo(
    () =>
      createTreeCollection<ChangedFileTreeNode>({
        rootNode: { id: "__root__", name: "root", type: "folder", children: changedFileTree },
        nodeToValue: (node) => node.id,
        nodeToString: (node) => node.name,
        nodeToChildren: (node) => node.children ?? [],
      }),
    [changedFileTree],
  );
  return (
    <Stack h="full" minH="0" gap="0">
      <Flex h="41px" minH="41px" align="center" justify="space-between" px="sm" borderBottomWidth="1px">
        <Text textStyle="label/S/medium" color="foreground.secondary" truncate>
          Changed files ({changedFilePaths.length})
        </Text>

        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton aria-label="Changed files view mode" variant="ghost" size="sm">
              {viewMode === "nested" ? <ListTree size={14} /> : <List size={14} />}
            </IconButton>
          </Menu.Trigger>
          <Menu.Positioner>
            <Menu.Content minW="160px" bg="bg">
              <Menu.Item value="nested" onClick={() => onViewModeChange("nested")}>
                <HStack gap="2xs">
                  <ListTree size={14} />
                  <Text>Nested</Text>
                </HStack>
              </Menu.Item>
              <Menu.Item value="flat" onClick={() => onViewModeChange("flat")}>
                <HStack gap="2xs">
                  <List size={14} />
                  <Text>Flat</Text>
                </HStack>
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Root>
      </Flex>

      <Stack gap="xs" px="sm" py="sm" borderBottomWidth="1px">
        <Input
          size="sm"
          placeholder="Filter files"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
        />
      </Stack>

      <ScrollArea flex="1" minH="0" contentProps={{ p: "xs" }}>
        {changedFilePaths.length > 0 ? (
          <TreeView.Root collection={collection} aria-label="Changed files" defaultExpandedValue={expandedFolders}>
            <TreeView.Tree>
              <TreeView.Node
                render={({ node, nodeState }) => {
                  const depth = viewMode === "nested" ? getPathDepth(node.id) : 0;

                  if (nodeState.isBranch) {
                    return (
                      <TreeView.BranchControl
                        gap="2xs"
                        py="2xs"
                        px="2xs"
                        pl={`calc(var(--chakra-spacing-2) + ${depth} * var(--chakra-spacing-4))`}
                        borderRadius="xs"
                        cursor="pointer"
                        _hover={{ bg: "bg.hover" }}
                      >
                        <Icon as={nodeState.expanded ? ChevronDown : ChevronRight} boxSize="14px" color="fg.muted" />
                        <Icon as={Folder} boxSize="14px" color="fg.muted" />
                        <TreeView.BranchText textStyle="paragraph/XS/medium" truncate minW="0">
                          {node.name}
                        </TreeView.BranchText>
                      </TreeView.BranchControl>
                    );
                  }

                  const filePath = node.id.replace(/^file:/, "");
                  const isSelected = selectedDiffPath === filePath;

                  return (
                    <TreeView.Item
                      gap="2xs"
                      py="2xs"
                      px="2xs"
                      pl={`calc(var(--chakra-spacing-2) + ${depth} * var(--chakra-spacing-4))`}
                      borderRadius="xs"
                      cursor="pointer"
                      bg={isSelected ? "bg.active" : "transparent"}
                      _hover={{ bg: isSelected ? "bg.active" : "bg.hover" }}
                      onClick={() => onSelectDiffPath(filePath)}
                    >
                      <Icon as={FileText} boxSize="14px" color="fg.subtle" flexShrink={0} />
                      <TreeView.ItemText textStyle="paragraph/XS/regular" truncate minW="0">
                        {node.name}
                      </TreeView.ItemText>
                    </TreeView.Item>
                  );
                }}
              />
            </TreeView.Tree>
          </TreeView.Root>
        ) : (
          <Box px="xs" py="xs">
            <EmptyState title="No matching files" size="sm" textAlign="left" alignItems="flex-start" />
          </Box>
        )}
      </ScrollArea>
    </Stack>
  );
};

const ArtifactsSection = (props: { artifacts: ApiWorkspaceArtifact[]; hasDiffs: boolean }) => {
  const { artifacts, hasDiffs } = props;

  if (artifacts.length === 0) {
    return null;
  }

  return (
    <Stack gap="0" px="sm" py="xs" borderBottomWidth={hasDiffs ? "1px" : "0"}>
      <Text textStyle="label/S/medium" color="foreground.secondary" py="xs">
        Artifacts
      </Text>

      <Menu.Root>
        {artifacts.map((artifact) => {
          const label = resolveArtifactLabel(artifact.relative_path);
          return <MenuItem key={artifact.id} primaryLabel={label} variant="compact" />;
        })}
      </Menu.Root>
    </Stack>
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
          <PanelLeft size={14} />
          {isTreePanelOpen ? "Hide file tree" : "Show file tree"}
        </Button>
      ) : null}
    </Flex>
  );
};

export const WorkspaceDiffPanel = (props: WorkspaceDiffPanelProps) => {
  const { diffs, artifacts, changedFiles, loading = false } = props;
  const [isTreePanelOpen, setTreePanelOpen] = useState(true);
  const [viewMode, setViewMode] = useState<ChangedFilesViewMode>("nested");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDiffPath, setSelectedDiffPath] = useState<string | null>(() =>
    resolveSelectedDiffPath(diffs, changedFiles),
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

    setSelectedDiffPath(resolveSelectedDiffPath(filteredDiffs, filteredChangedFiles));
  }, [filteredChangedFiles, filteredDiffs, selectedDiffPath]);

  if (loading) {
    return <WorkspaceDiffPanelLoading />;
  }

  const resolvedSelectedDiffPath = selectedDiffPath ?? resolveSelectedDiffPath(filteredDiffs, filteredChangedFiles);
  const handleSelectDiffPath = (path: string) => {
    setSelectedDiffPath(path);
  };

  return (
    <Flex h="full" minH="0" minW="0" flex="1" bg="bg.subtle" gap="0" data-testid="workspace-diff-panel">
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
        <ArtifactsSection artifacts={artifacts} hasDiffs={hasDiffs} />

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
  );
};
