import type { TreeNode as ExtensionTreeNode, TreeNodePage, TreeRendererPageParams } from "@pstdio/sdk/extensions";
import type { TreeContext, TreeNode, TreePageLoader } from "../../core";
import { createQueryParams, executeCallback } from "./tree-renderer-callbacks";
import type { ExtensionTreeRendererRecord } from "./tree-renderer-contribution-types";
import type { RegisterWorkbenchExtensionTreeRenderersInput } from "./tree-renderer-contributions";

export const treePageLoader = (
  input: RegisterWorkbenchExtensionTreeRenderersInput,
  record: ExtensionTreeRendererRecord,
  ctx: TreeContext,
  parent: TreeRendererPageParams["parent"],
  mapNode: (node: ExtensionTreeNode, ctx: TreeContext) => TreeNode,
  cursor?: string,
  visited = new Set<string>(),
): TreePageLoader | undefined => {
  if (!cursor || !record.pageHandlerId) return undefined;
  return async (signal) => {
    signal.throwIfAborted();
    const result = (await executeCallback(
      input,
      record,
      record.pageHandlerId!,
      {
        ...createQueryParams(input, record, ctx),
        cursor,
        parent,
      },
      signal,
    )) as TreeNodePage;
    signal.throwIfAborted();
    if (!result || !Array.isArray(result.nodes)) throw new Error("The tree provider returned an invalid page.");
    const seen = new Set([...visited, cursor]);
    if (result.nextCursor && seen.has(result.nextCursor))
      throw new Error("The tree provider returned a repeated cursor.");
    return {
      nodes: result.nodes.map((node) => mapNode(node, ctx)),
      nextPage: treePageLoader(input, record, ctx, parent, mapNode, result.nextCursor, seen),
    };
  };
};
