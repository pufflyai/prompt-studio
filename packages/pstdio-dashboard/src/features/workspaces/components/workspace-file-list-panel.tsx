import {
  Box,
  createTreeCollection,
  Flex,
  HStack,
  IconButton,
  Input,
  Menu,
  Stack,
  Text,
  TreeView,
} from "@chakra-ui/react";
import { EmptyState, ScrollArea } from "@pstdio/ui";
import { List, ListTree } from "lucide-react";
import { type ReactNode, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import {
  buildChangedFilesTree,
  type ChangedFilesViewMode,
  type ChangedFileTreeNode,
} from "../utils/build-changed-files-tree";
import { type FileIconInfo, WorkspaceFileTreeNode } from "./workspace-file-tree-node";

export type { FileIconInfo } from "./workspace-file-tree-node";

const clampPanelWidth = (width: number, min: number, max: number) => Math.min(Math.max(width, min), max);

export const ResizableLeftPanel = (props: { children: ReactNode }) => {
  const { children } = props;
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
        aria-label="Resize file list panel"
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
      {children}
    </Flex>
  );
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

export const resolveSelectedPath = (preferredPaths: string[], fallbackPaths: string[]) => {
  const firstPath = preferredPaths[0] ?? null;
  if (firstPath) return firstPath;

  return fallbackPaths[0] ?? null;
};

interface FileListPanelProps {
  title: string;
  paths: string[];
  selectedPath: string | null;
  onSelectPath: (path: string) => void;
  viewMode: ChangedFilesViewMode;
  onViewModeChange: (mode: ChangedFilesViewMode) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  resolveFileIcon?: (path: string) => FileIconInfo;
  emptyTitle?: string;
  showHeader?: boolean;
  showFilter?: boolean;
}

export const FileListPanel = (props: FileListPanelProps) => {
  const {
    title,
    paths,
    selectedPath,
    onSelectPath,
    viewMode,
    onViewModeChange,
    searchQuery,
    onSearchQueryChange,
    resolveFileIcon,
    emptyTitle = "No matching files",
    showHeader = true,
    showFilter = true,
  } = props;
  const fileTree = buildChangedFilesTree(paths, viewMode);
  const expandedFolders = viewMode === "nested" ? collectExpandedFolderIds(fileTree) : [];
  const collection = createTreeCollection<ChangedFileTreeNode>({
    rootNode: { id: "__root__", name: "root", type: "folder", children: fileTree },
    nodeToValue: (node) => node.id,
    nodeToString: (node) => node.name,
    nodeToChildren: (node) => node.children ?? [],
  });

  return (
    <Stack h="full" minH="0" minW="0" w="full" gap="0" overflow="hidden">
      {showHeader && (
        <Flex h="41px" minH="41px" align="center" justify="space-between" px="sm" borderBottomWidth="1px">
          <Text textStyle="label/S/medium" color="foreground.secondary" truncate>
            {title} ({paths.length})
          </Text>

          <Menu.Root>
            <Menu.Trigger asChild>
              <IconButton aria-label="File list view mode" variant="ghost" size="sm">
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
      )}

      {showFilter && (
        <Stack gap="xs" px="sm" py="sm" borderBottomWidth="1px">
          <Input
            size="sm"
            placeholder="Filter files"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
        </Stack>
      )}

      <ScrollArea
        flex="1"
        minH="0"
        minW="0"
        viewportProps={{ style: { overflowX: "hidden" } }}
        contentProps={{ p: "xs", w: "full", style: { minWidth: 0 } }}
      >
        {paths.length > 0 ? (
          <TreeView.Root
            collection={collection}
            aria-label={title}
            defaultExpandedValue={expandedFolders}
            w="full"
            minW="0"
          >
            <TreeView.Tree w="full" minW="0">
              <TreeView.Node
                render={({ node, nodeState }) => (
                  <WorkspaceFileTreeNode
                    node={node}
                    nodeState={nodeState}
                    selectedPath={selectedPath}
                    viewMode={viewMode}
                    onSelectPath={onSelectPath}
                    resolveFileIcon={resolveFileIcon}
                  />
                )}
              />
            </TreeView.Tree>
          </TreeView.Root>
        ) : (
          <Box px="xs" py="xs">
            <EmptyState title={emptyTitle} size="sm" textAlign="left" alignItems="flex-start" />
          </Box>
        )}
      </ScrollArea>
    </Stack>
  );
};
