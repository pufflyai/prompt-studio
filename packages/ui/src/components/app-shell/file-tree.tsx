import { Stack, Text } from "@chakra-ui/react";
import { File } from "lucide-react";
import { useState } from "react";

import { TreeList } from "../tree-list/tree-list";
import type { TreeListNode } from "../tree-list/tree-list.types";

interface FileTreeProps {
  paths: string[];
  selectedPath: string | null;
  onSelectPath: (path: string) => void;
}

interface RawNode {
  id: string;
  name: string;
  path: string | null;
  type: "file" | "folder";
  children: RawNode[];
}

const buildTree = (paths: string[]): RawNode[] => {
  const root: RawNode[] = [];

  for (const path of paths) {
    const segments = path.split("/").filter(Boolean);
    let level = root;
    let parentPath = "";

    segments.forEach((segment, index) => {
      const isFile = index === segments.length - 1;
      const id = parentPath ? `${parentPath}/${segment}` : segment;
      let node = level.find((entry) => entry.name === segment && entry.type === (isFile ? "file" : "folder"));

      if (!node) {
        node = {
          id,
          name: segment,
          path: isFile ? path : null,
          type: isFile ? "file" : "folder",
          children: [],
        };
        level.push(node);
      }

      parentPath = id;
      level = node.children;
    });
  }

  const sort = (nodes: RawNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) sort(node.children);
  };

  sort(root);
  return root;
};

const collectFolderIds = (nodes: RawNode[]) => {
  const ids: string[] = [];
  const visit = (items: RawNode[]) => {
    for (const item of items) {
      if (item.type === "folder") {
        ids.push(item.id);
        visit(item.children);
      }
    }
  };
  visit(nodes);
  return ids;
};

const toTreeListNodes = (nodes: RawNode[], onSelectPath: (path: string) => void): TreeListNode[] => {
  return nodes.map((node) => {
    const isFolder = node.type === "folder";
    if (isFolder) {
      return {
        id: node.id,
        label: node.name,
        isContainer: true,
        children: toTreeListNodes(node.children, onSelectPath),
      };
    }

    return {
      id: node.id,
      label: node.name,
      icon: <File size={12} />,
      onActivate: () => {
        if (node.path) onSelectPath(node.path);
      },
    };
  });
};

export const FileTree = (props: FileTreeProps) => {
  const { paths, selectedPath, onSelectPath } = props;
  const tree = buildTree(paths);
  const nodes = toTreeListNodes(tree, onSelectPath);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(collectFolderIds(tree)));

  const toggle = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (tree.length === 0) {
    return (
      <Text textStyle="label/XS" color="fg.muted" px="sm" py="xs">
        No files.
      </Text>
    );
  }

  return (
    <Stack gap="0" minW="0">
      <TreeList
        sections={[{ id: "files", nodes }]}
        expandedNodeIds={[...expanded]}
        activeNodeId={selectedPath}
        rowVariant="tree"
        onToggleNode={toggle}
      />
    </Stack>
  );
};
