import { Badge, Box, HStack, Icon, Input, InputGroup, Stack, Text } from "@chakra-ui/react";
import { FileText, Search } from "lucide-react";
import { useRef } from "react";
import { EmptyState } from "../empty-state";
import { Header } from "../header";
import { ScrollArea } from "../scroll-area";
import { TreeList } from "../tree-list/tree-list";
import type { TreeListNode } from "../tree-list/tree-list.types";
import { buildChangedFilesTree } from "./build-changed-files-tree";
import type { ChangedFilesViewMode, ChangedFileTreeNode, FileIconInfo } from "./types";

interface FileListPanelProps {
  title: string;
  paths: string[];
  selectedPath: string | null;
  viewMode: ChangedFilesViewMode;
  searchQuery: string;
  expandedFolderIds: Set<string>;
  onSelectPath: (path: string) => void;
  onSearchQueryChange: (value: string) => void;
  onToggleFolder: (id: string) => void;
  resolveFileIcon?: (path: string, options?: { isFolder?: boolean; isExpanded?: boolean }) => FileIconInfo | undefined;
  changeByPath?: Map<string, string>;
}

const changeLabels: Record<string, string> = {
  added: "A",
  copied: "C",
  deleted: "D",
  modified: "U",
  permissionChange: "M",
  renamed: "R",
};

const changeColors: Record<string, string> = {
  added: "green",
  copied: "purple",
  deleted: "red",
  modified: "blue",
  permissionChange: "yellow",
  renamed: "orange",
};

const changeSemanticStyles: Record<string, { color: string; backgroundColor: string }> = {
  added: { color: "fg.success", backgroundColor: "bg.success" },
  deleted: { color: "fg.error", backgroundColor: "bg.error" },
};

const getFilePathParts = (filePath: string) => {
  const lastSlashIndex = filePath.lastIndexOf("/");
  if (lastSlashIndex < 0) return { fileName: filePath, dirPath: "" };
  return { fileName: filePath.slice(lastSlashIndex + 1), dirPath: filePath.slice(0, lastSlashIndex) };
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
  resolveFileIcon?: (path: string, options?: { isFolder?: boolean; isExpanded?: boolean }) => FileIconInfo | undefined;
  changeByPath?: Map<string, string>;
}): TreeListNode[] => {
  const { nodes, viewMode, onSelectPath, resolveFileIcon, changeByPath } = input;

  return nodes.map((node) => {
    if (node.type === "folder") {
      return {
        id: node.id,
        label: node.name,
        isContainer: true,
        children: toTreeListNodes({
          nodes: node.children ?? [],
          viewMode,
          onSelectPath,
          resolveFileIcon,
          changeByPath,
        }),
      };
    }

    const filePath = node.id.replace(/^file:/, "");
    const fileIcon = resolveFileIcon?.(filePath) ?? { icon: <Icon as={FileText} boxSize="14px" />, color: "fg.subtle" };
    const change = changeByPath?.get(filePath);
    const changeBadgeProps = change
      ? (changeSemanticStyles[change] ?? { colorPalette: changeColors[change] ?? "gray" })
      : {};

    return {
      id: node.id,
      label: renderFileLabel(node, viewMode, filePath),
      icon: fileIcon.icon,
      iconColor: fileIcon.color,
      endContent: change ? (
        <Badge size="sm" variant="subtle" flexShrink={0} {...changeBadgeProps}>
          {changeLabels[change] ?? change}
        </Badge>
      ) : undefined,
      onActivate: () => onSelectPath(filePath),
    };
  });
};

export const FileListPanel = (props: FileListPanelProps) => {
  const {
    title,
    paths,
    selectedPath,
    viewMode,
    searchQuery,
    expandedFolderIds,
    onSelectPath,
    onSearchQueryChange,
    onToggleFolder,
    resolveFileIcon,
    changeByPath,
  } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileTree = buildChangedFilesTree(paths, viewMode);
  const treeNodes = toTreeListNodes({ nodes: fileTree, viewMode, onSelectPath, resolveFileIcon, changeByPath });
  const emptyTitle = searchQuery.trim() ? "No matching files" : "No changed files";

  return (
    <Stack h="full" minH="0" minW="0" w="full" gap="0" overflow="hidden" bg="bg">
      <Header variant="main" justifyContent="space-between" borderBottomWidth="1px" borderColor="border.muted" bg="bg">
        <HStack gap="2xs" minW="0">
          <Text textStyle="label/S/medium" color="foreground.secondary" truncate>
            {title}
          </Text>
          <Badge size="sm" variant="subtle" flexShrink={0} bg="bg.muted" color="fg.muted">
            {paths.length}
          </Badge>
        </HStack>
      </Header>
      <Stack gap="xs" borderBottomWidth="1px" bg="bg">
        <InputGroup startElement={<Search size={14} />}>
          <Input
            size="sm"
            border="0"
            borderRadius="0"
            placeholder="Filter files"
            value={searchQuery}
            _hover={{ borderColor: "transparent" }}
            _focus={{ borderColor: "transparent", boxShadow: "none" }}
            _focusVisible={{ borderColor: "transparent", boxShadow: "none", outline: "none" }}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
        </InputGroup>
      </Stack>
      <ScrollArea
        flex="1"
        minH="0"
        minW="0"
        bg="bg"
        viewportRef={scrollRef}
        viewportProps={{ style: { overflowX: "hidden" } }}
      >
        {paths.length > 0 ? (
          <TreeList
            sections={[{ id: "files", nodes: treeNodes }]}
            expandedNodeIds={[...expandedFolderIds]}
            activeNodeId={selectedPath ? `file:${selectedPath}` : null}
            rowVariant="tree"
            onToggleNode={onToggleFolder}
            virtualize
            scrollRef={scrollRef}
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
