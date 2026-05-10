import { Box, HStack, Icon, IconButton, Input, Menu, Stack, Text } from "@chakra-ui/react";
import { EmptyState, Header, ScrollArea, TreeList, type TreeListNode } from "@pstdio/ui";
import { FileText, Folder, List, ListTree, type LucideIcon } from "lucide-react";
import { useRef, useState } from "react";
import {
  buildChangedFilesTree,
  type ChangedFilesViewMode,
  type ChangedFileTreeNode,
} from "../utils/build-changed-files-tree";

export interface FileIconInfo {
  icon: LucideIcon;
  color: string;
}

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

const getFilePathParts = (filePath: string) => {
  const lastSlashIndex = filePath.lastIndexOf("/");
  if (lastSlashIndex < 0) {
    return { fileName: filePath, dirPath: "" };
  }

  return {
    fileName: filePath.slice(lastSlashIndex + 1),
    dirPath: filePath.slice(0, lastSlashIndex),
  };
};

const renderFileLabel = (node: ChangedFileTreeNode, viewMode: ChangedFilesViewMode, filePath: string) => {
  const { fileName, dirPath } = getFilePathParts(filePath);
  if (viewMode !== "flat" || !dirPath) return node.name;

  return (
    <Text textStyle="label/S/regular" truncate>
      <Text as="span" color="fg.default">
        {fileName}
      </Text>{" "}
      <Text as="span" color="fg.muted">
        {dirPath}
      </Text>
    </Text>
  );
};

const toTreeListNodes = (input: {
  nodes: ChangedFileTreeNode[];
  viewMode: ChangedFilesViewMode;
  onSelectPath: (path: string) => void;
  resolveFileIcon?: (path: string) => FileIconInfo;
}): TreeListNode[] => {
  const { nodes, viewMode, onSelectPath, resolveFileIcon } = input;

  return nodes.map((node) => {
    if (node.type === "folder") {
      return {
        id: node.id,
        label: node.name,
        icon: <Icon as={Folder} boxSize="14px" />,
        isContainer: true,
        children: toTreeListNodes({
          nodes: node.children ?? [],
          viewMode,
          onSelectPath,
          resolveFileIcon,
        }),
      };
    }

    const filePath = node.id.replace(/^file:/, "");
    const fileIcon = resolveFileIcon?.(filePath) ?? { icon: FileText, color: "fg.subtle" };

    return {
      id: node.id,
      label: renderFileLabel(node, viewMode, filePath),
      icon: <Icon as={fileIcon.icon} boxSize="14px" />,
      iconColor: fileIcon.color,
      onActivate: () => onSelectPath(filePath),
    };
  });
};

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
  const treeNodes = toTreeListNodes({ nodes: fileTree, viewMode, onSelectPath, resolveFileIcon });
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(viewMode === "nested" ? collectExpandedFolderIds(fileTree) : []),
  );
  const previousViewModeRef = useRef(viewMode);

  if (previousViewModeRef.current !== viewMode) {
    previousViewModeRef.current = viewMode;
    setExpanded(new Set(viewMode === "nested" ? collectExpandedFolderIds(fileTree) : []));
  }

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Stack h="full" minH="0" minW="0" w="full" gap="0" overflow="hidden">
      {showHeader && (
        <Header variant="main" justifyContent="space-between" borderBottomWidth="1px" borderColor="border.muted">
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
        </Header>
      )}

      {showFilter && (
        <Stack gap="xs" borderBottomWidth="1px">
          <Input
            size="sm"
            border="0"
            borderRadius="0"
            placeholder="Filter files"
            value={searchQuery}
            _hover={{ borderColor: "transparent" }}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
        </Stack>
      )}

      <ScrollArea
        flex="1"
        minH="0"
        minW="0"
        viewportProps={{ style: { overflowX: "hidden" } }}
        contentProps={{ w: "full", style: { minWidth: 0 } }}
      >
        {paths.length > 0 ? (
          <TreeList
            sections={[{ id: "files", nodes: treeNodes }]}
            expandedNodeIds={[...expanded]}
            activeNodeId={selectedPath ? `file:${selectedPath}` : null}
            rowVariant="tree"
            onToggleNode={toggle}
          />
        ) : (
          <Box px="xs" py="xs">
            <EmptyState title={emptyTitle} size="sm" textAlign="left" alignItems="flex-start" />
          </Box>
        )}
      </ScrollArea>
    </Stack>
  );
};
