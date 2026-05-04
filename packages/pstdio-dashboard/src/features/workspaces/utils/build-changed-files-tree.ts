import type { ApiFileDiff } from "@/shared/api-types";

export type ChangedFilesViewMode = "nested" | "flat";

export interface ChangedFileTreeNode {
  id: string;
  name: string;
  type: "folder" | "file";
  children?: ChangedFileTreeNode[];
}

const normalizeChangedFilePath = (path: string) =>
  path
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");

const sortNodes = (nodes: ChangedFileTreeNode[]) => {
  nodes.sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === "folder" ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });

  nodes.forEach((node) => {
    if (node.children) {
      sortNodes(node.children);
    }
  });

  return nodes;
};

export const collectChangedFilePaths = (files: ApiFileDiff[]) =>
  files.map((file) => normalizeChangedFilePath(file.newPath ?? file.oldPath ?? file.filePath)).filter(Boolean);

const dedupePaths = (paths: string[]) => Array.from(new Set(paths.map(normalizeChangedFilePath).filter(Boolean)));

const buildFlatTree = (paths: string[]) =>
  dedupePaths(paths)
    .map((path) => ({ id: `file:${path}`, name: path, type: "file" }) satisfies ChangedFileTreeNode)
    .sort((left, right) => left.name.localeCompare(right.name));

export const buildChangedFilesTree = (paths: string[], mode: ChangedFilesViewMode): ChangedFileTreeNode[] => {
  if (mode === "flat") {
    return buildFlatTree(paths);
  }

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

      if (!parentNode) {
        rootNodes.push(nextNode);
      } else {
        parentNode.children?.push(nextNode);
      }

      parentNode = nextNode;
      parentPath = currentPath;
    });
  });

  return sortNodes(rootNodes);
};
