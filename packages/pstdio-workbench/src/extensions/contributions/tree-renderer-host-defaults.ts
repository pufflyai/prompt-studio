import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { TreeContext, TreeNode } from "../../core";
import type { ExtensionTreeRendererRecord, ExtensionTreeViewRecord } from "./tree-renderer-contribution-types";

export interface HostTreeDefaultNodesInput {
  ctx: TreeContext;
  record: ExtensionTreeRendererRecord;
  view: ExtensionTreeViewRecord;
}

export type HostTreeDefaultNodesResolver = (input: HostTreeDefaultNodesInput) => Promise<TreeNode[]> | TreeNode[];

interface ResolveHostTreeDefaultInput {
  ctx: TreeContext;
  record: ExtensionTreeRendererRecord;
  treeViews: ExtensionTreeViewRecord[];
}

interface ResolveHostTreeHeaderInput extends ResolveHostTreeDefaultInput {
  getHostTreeHeaderNodes?: HostTreeDefaultNodesResolver;
}

interface ResolveHostTreeFooterInput extends ResolveHostTreeDefaultInput {
  getHostTreeFooterNodes?: HostTreeDefaultNodesResolver;
}

export const treeViewsFor = (metadata: WorkbenchExtensionMetadata, record: ExtensionTreeRendererRecord) =>
  metadata.views.filter((view) => view.treeRendererId === record.id);

const resolveTreeView = (views: ExtensionTreeViewRecord[], ctx: TreeContext) => {
  if (ctx.viewId) return views.find((view) => view.id === ctx.viewId);
  return views.length === 1 ? views[0] : undefined;
};

export const resolveHostTreeHeaderNodes = async (input: ResolveHostTreeHeaderInput) => {
  const { ctx, getHostTreeHeaderNodes, record, treeViews } = input;
  const view = resolveTreeView(treeViews, ctx);
  if (view?.hostTreeHeader !== "default") return [];
  return (await getHostTreeHeaderNodes?.({ ctx, record, view })) ?? [];
};

export const resolveHostTreeFooterNodes = async (input: ResolveHostTreeFooterInput) => {
  const { ctx, getHostTreeFooterNodes, record, treeViews } = input;
  const view = resolveTreeView(treeViews, ctx);
  if (view?.hostTreeFooter !== "default") return [];
  return (await getHostTreeFooterNodes?.({ ctx, record, view })) ?? [];
};
