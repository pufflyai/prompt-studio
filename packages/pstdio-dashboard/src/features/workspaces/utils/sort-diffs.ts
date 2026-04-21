import type { Diff } from "@pstdio/ui";
import { buildChangedFilesTree, type ChangedFilesViewMode, type ChangedFileTreeNode } from "./build-changed-files-tree";

const normalizePath = (path: string) =>
  path
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");

const resolveDiffPath = (diff: Diff) => normalizePath(diff.newPath ?? diff.oldPath ?? "unknown");

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

export const sortDiffs = (diffs: Diff[], mode: ChangedFilesViewMode) => {
  const withMeta = diffs.map((diff, index) => ({ diff, index, path: resolveDiffPath(diff) }));

  if (mode === "flat") {
    return [...withMeta]
      .sort((left, right) => left.path.localeCompare(right.path) || left.index - right.index)
      .map((item) => item.diff);
  }

  const sortedPaths = collectNestedFileOrder(
    buildChangedFilesTree(
      withMeta.map((item) => item.path),
      "nested",
    ),
  );
  const orderByPath = new Map(sortedPaths.map((path, index) => [path, index]));

  return [...withMeta]
    .sort((left, right) => {
      const leftOrder = orderByPath.get(left.path) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = orderByPath.get(right.path) ?? Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.index - right.index;
    })
    .map((item) => item.diff);
};
