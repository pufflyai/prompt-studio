import { HStack, Icon, Text, TreeView } from "@chakra-ui/react";
import { ChevronDown, ChevronRight, FileText, Folder, type LucideIcon } from "lucide-react";
import type { ChangedFilesViewMode, ChangedFileTreeNode } from "../utils/build-changed-files-tree";

const getPathDepth = (nodeId: string) => {
  const path = nodeId.replace(/^(file|folder):/, "");
  const depth = path.split("/").length - 1;

  return Math.max(depth, 0);
};

export interface FileIconInfo {
  icon: LucideIcon;
  color: string;
}

interface FileTreeNodeState {
  isBranch: boolean;
  expanded: boolean;
}

interface WorkspaceFileTreeNodeProps {
  node: ChangedFileTreeNode;
  nodeState: FileTreeNodeState;
  selectedPath: string | null;
  viewMode: ChangedFilesViewMode;
  onSelectPath: (path: string) => void;
  resolveFileIcon?: (path: string) => FileIconInfo;
}

interface WorkspaceFolderTreeNodeProps {
  depth: number;
  name: string;
  expanded: boolean;
}

interface WorkspaceFileTreeItemProps {
  depth: number;
  node: ChangedFileTreeNode;
  selectedPath: string | null;
  viewMode: ChangedFilesViewMode;
  onSelectPath: (path: string) => void;
  resolveFileIcon?: (path: string) => FileIconInfo;
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

const WorkspaceFolderTreeNode = (props: WorkspaceFolderTreeNodeProps) => {
  const { depth, name, expanded } = props;

  return (
    <TreeView.BranchControl
      gap="2xs"
      py="2xs"
      px="2xs"
      pl={`calc(var(--chakra-spacing-2) + ${depth} * var(--chakra-spacing-4))`}
      borderRadius="xs"
      cursor="pointer"
      w="full"
      minW="0"
      overflow="hidden"
      _hover={{ bg: "bg.hover" }}
    >
      <Icon as={expanded ? ChevronDown : ChevronRight} boxSize="14px" color="fg.muted" flexShrink={0} />
      <Icon as={Folder} boxSize="14px" color="fg.muted" flexShrink={0} />
      <TreeView.BranchText textStyle="paragraph/XS/medium" truncate minW="0">
        {name}
      </TreeView.BranchText>
    </TreeView.BranchControl>
  );
};

const WorkspaceFileTreeItem = (props: WorkspaceFileTreeItemProps) => {
  const { depth, node, selectedPath, viewMode, onSelectPath, resolveFileIcon } = props;
  const filePath = node.id.replace(/^file:/, "");
  const isSelected = selectedPath === filePath;
  const fileIcon = resolveFileIcon?.(filePath) ?? { icon: FileText, color: "fg.subtle" };
  const { fileName, dirPath } = getFilePathParts(filePath);
  const useFlatDisplay = viewMode === "flat" && dirPath;

  return (
    <TreeView.Item
      gap="2xs"
      py="2xs"
      px="2xs"
      pl={`calc(var(--chakra-spacing-2) + ${depth} * var(--chakra-spacing-4))`}
      borderRadius="xs"
      cursor="pointer"
      w="full"
      minW="0"
      overflow="hidden"
      bg={isSelected ? "bg.active" : "transparent"}
      _hover={{ bg: isSelected ? "bg.active" : "bg.hover" }}
      onClick={() => onSelectPath(filePath)}
    >
      <Icon as={fileIcon.icon} boxSize="14px" color={fileIcon.color} flexShrink={0} />
      <TreeView.ItemText textStyle="paragraph/XS/regular" truncate minW="0">
        {useFlatDisplay ? (
          <HStack gap="xs">
            <Text as="span" color="fg.default">
              {fileName}
            </Text>
            <Text as="span" color="fg.muted">
              {dirPath}
            </Text>
          </HStack>
        ) : (
          node.name
        )}
      </TreeView.ItemText>
    </TreeView.Item>
  );
};

export const WorkspaceFileTreeNode = (props: WorkspaceFileTreeNodeProps) => {
  const { node, nodeState, selectedPath, viewMode, onSelectPath, resolveFileIcon } = props;
  const depth = viewMode === "nested" ? getPathDepth(node.id) : 0;

  if (nodeState.isBranch) {
    return <WorkspaceFolderTreeNode depth={depth} name={node.name} expanded={nodeState.expanded} />;
  }

  return (
    <WorkspaceFileTreeItem
      depth={depth}
      node={node}
      selectedPath={selectedPath}
      viewMode={viewMode}
      onSelectPath={onSelectPath}
      resolveFileIcon={resolveFileIcon}
    />
  );
};
