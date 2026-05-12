import type { ContributionMetadata, RegisteredContributionMetadata } from "../contributions/metadata";
import { byContributionPriority, normalizeContributionMetadata } from "../contributions/metadata";
import { createDisposable } from "../disposable";
import type { ShellArea } from "../layout/layout-model";
import type { ResourceRef } from "../resources/resource-registry";

export interface TreeContext {
  filter?: string;
}

export interface TreeNode {
  id: string;
  label: string;
  icon?: string;
  resource?: ResourceRef;
  collapsible?: boolean;
  description?: string;
  contextValue?: string;
}

export interface TreeViewContribution {
  id: string;
  title: string;
  area?: Extract<ShellArea, "left" | "right" | "bottom">;
  icon?: string;
  when?: string;
  getRoots(ctx: TreeContext): Promise<TreeNode[]> | TreeNode[];
  getChildren(node: TreeNode, ctx: TreeContext): Promise<TreeNode[]> | TreeNode[];
}

export interface RegisteredTreeViewContribution extends TreeViewContribution, RegisteredContributionMetadata {}

export const createTreeViewRegistry = () => {
  const views = new Map<string, RegisteredTreeViewContribution>();

  const findView = (id: string) => {
    const view = views.get(id);
    if (!view) throw new Error(`Tree view not registered: ${id}`);
    return view;
  };

  return {
    registerTreeView(view: TreeViewContribution, metadata?: ContributionMetadata) {
      if (views.has(view.id)) throw new Error(`Tree view already registered: ${view.id}`);

      const record = {
        ...normalizeContributionMetadata(metadata),
        ...view,
      };

      views.set(view.id, record);

      return createDisposable(() => {
        if (views.get(view.id) === record) views.delete(view.id);
      });
    },

    getTreeView(id: string) {
      return views.get(id);
    },

    listTreeViews() {
      return [...views.values()].sort(byContributionPriority);
    },

    async getRoots(id: string, ctx: TreeContext = {}) {
      return await findView(id).getRoots(ctx);
    },

    async getChildren(id: string, node: TreeNode, ctx: TreeContext = {}) {
      return await findView(id).getChildren(node, ctx);
    },
  };
};

export type TreeViewRegistry = ReturnType<typeof createTreeViewRegistry>;
