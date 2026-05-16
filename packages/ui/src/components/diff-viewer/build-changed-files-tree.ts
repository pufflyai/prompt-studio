import type { ChangedFilesViewMode, ChangedFileTreeNode } from "./types";

const normalizeChangedFilePath = (path: string) =>
  path
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");

const sortNodes = (nodes: ChangedFileTreeNode[]) => {
  nodes.sort((left, right) => {
    if (left.type !== right.type) return left.type === "folder" ? -1 : 1;
    return left.name.localeCompare(right.name);
  });

  nodes.forEach((node) => {
    if (node.children) sortNodes(node.children);
  });

  return nodes;
};

const dedupePaths = (paths: string[]) => Array.from(new Set(paths.map(normalizeChangedFilePath).filter(Boolean)));

const buildFlatTree = (paths: string[]) =>
  dedupePaths(paths)
    .map((path) => ({ id: `file:${path}`, name: path, type: "file" }) satisfies ChangedFileTreeNode)
    .sort((left, right) => left.name.localeCompare(right.name));

export const buildChangedFilesTree = (paths: string[], mode: ChangedFilesViewMode): ChangedFileTreeNode[] => {
  if (mode === "flat") return buildFlatTree(paths);

  const treeById = new Map<string, ChangedFileTreeNode>();
  const rootNodes: ChangedFileTreeNode[] = [];

  dedupePaths(paths).forEach((path) => {
    const segments = path.split("/");
    let parentPath = "";
    let parentNode: ChangedFileTreeNode | null = null;

    segments.forEach((segment, index) => {
      const currentPath = parentPath ? `${parentPath}/${segment}` : segment;
      const isFile = index === segments.length - 1;
      const nodeId = `${isFile ? "file" : "folder"}:${currentPath}`;
      const existingNode = treeById.get(nodeId);

      if (existingNode) {
        parentNode = existingNode;
        parentPath = currentPath;
        return;
      }

      const nextNode: ChangedFileTreeNode = {
        id: nodeId,
        name: segment,
        type: isFile ? "file" : "folder",
        ...(isFile ? {} : { children: [] }),
      };

      treeById.set(nodeId, nextNode);

      if (!parentNode) rootNodes.push(nextNode);
      else parentNode.children?.push(nextNode);

      parentNode = nextNode;
      parentPath = currentPath;
    });
  });

  return sortNodes(rootNodes);
};

export const collectExpandedFolderIds = (nodes: ChangedFileTreeNode[]) => {
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

const collectNestedFileOrder = (nodes: ChangedFileTreeNode[]) => {
  const orderedPaths: string[] = [];

  const visit = (treeNodes: ChangedFileTreeNode[]) => {
    treeNodes.forEach((node) => {
      if (node.type === "file") {
        orderedPaths.push(node.id.replace(/^file:/, ""));
        return;
      }

      visit(node.children ?? []);
    });
  };

  visit(nodes);
  return orderedPaths;
};

export const sortPathsByViewMode = (paths: string[], mode: ChangedFilesViewMode) => {
  if (mode === "flat") return [...paths].sort((left, right) => left.localeCompare(right));
  return collectNestedFileOrder(buildChangedFilesTree(paths, "nested"));
};
