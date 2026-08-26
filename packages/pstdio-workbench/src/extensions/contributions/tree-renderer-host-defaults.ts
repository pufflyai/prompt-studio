import type { TreeContext, TreeNode } from "../../core";
import type { InternalWorkbenchExtensionMetadata as WorkbenchExtensionMetadata } from "../host/internal-workbench-extension-metadata";
import type { ExtensionTreeRendererRecord, ExtensionTreeViewRecord } from "./tree-renderer-contribution-types";

export interface HostTreeDefaultNodesInput {
  ctx: TreeContext;
  record: ExtensionTreeRendererRecord;
  panel: ExtensionTreeViewRecord;
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
  metadata.panels
    .flatMap((panel) => [panel, ...(panel.panelMenus ?? [])])
    .filter((panel) => panel.renderer?.kind === "tree" && panel.renderer.id === record.id);

const resolveTreeView = (panels: ExtensionTreeViewRecord[], ctx: TreeContext) => {
  if (ctx.viewId) return panels.find((panel) => panel.id === ctx.viewId);
  return panels.length === 1 ? panels[0] : undefined;
};

export const resolveHostTreeHeaderNodes = async (input: ResolveHostTreeHeaderInput) => {
  const { ctx, getHostTreeHeaderNodes, record, treeViews } = input;
  const panel = resolveTreeView(treeViews, ctx);
  if (!panel || !("hostTreeHeader" in panel) || panel.hostTreeHeader !== "default") return [];
  return (await getHostTreeHeaderNodes?.({ ctx, record, panel })) ?? [];
};

export const resolveHostTreeFooterNodes = async (input: ResolveHostTreeFooterInput) => {
  const { ctx, getHostTreeFooterNodes, record, treeViews } = input;
  const panel = resolveTreeView(treeViews, ctx);
  if (!panel || !("hostTreeFooter" in panel) || panel.hostTreeFooter !== "default") return [];
  return (await getHostTreeFooterNodes?.({ ctx, record, panel })) ?? [];
};
