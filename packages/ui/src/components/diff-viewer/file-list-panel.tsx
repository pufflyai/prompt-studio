import { Box, Icon, Input, InputGroup, Stack, Text } from "@chakra-ui/react";
import { FileText, Search } from "lucide-react";
import { useRef } from "react";
import { Header } from "@/components/layout/header";
import { EmptyState } from "@/components/primitives/empty-state";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { TreeList } from "../tree-list/tree-list";
import type { TreeListNode } from "../tree-list/tree-list.types";
import { buildChangedFilesTree } from "./build-changed-files-tree";
import { FileChangeBadge } from "./file-change-badge";
import type { ChangedFilesViewMode, ChangedFileTreeNode, FileIconInfo } from "./types";

interface FileListPanelProps {
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
    const fileIcon = resolveFileIcon?.(filePath) ?? { icon: <Icon as={FileText} boxSize="16px" />, color: "fg.subtle" };
    const change = changeByPath?.get(filePath);
    return {
      id: node.id,
      label: renderFileLabel(node, viewMode, filePath),
      icon: fileIcon.icon,
      iconColor: fileIcon.color,
      endContent: change ? <FileChangeBadge change={change} /> : undefined,
      onActivate: () => onSelectPath(filePath),
    };
  });
};

export const FileListPanel = (props: FileListPanelProps) => {
  const {
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
      <Header flexShrink={0} borderBottomWidth="1px" borderColor="border.subtle" bg="bg">
        <InputGroup startElement={<Search size={14} />}>
          <Input
            size="sm"
            variant="borderless"
            aria-label="Search files"
            placeholder="Search files"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
        </InputGroup>
      </Header>
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
