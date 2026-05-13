import type { ContributionMetadata, RegisteredContributionMetadata } from "../contributions/metadata";
import { byContributionPriority, normalizeContributionMetadata } from "../contributions/metadata";
import { createDisposable } from "../disposable";
import type { ShellArea } from "../layout/layout-model";
import type { MenuPath } from "../menus/menu-registry";
import type { ResourceRef } from "../resources/resource-registry";

export interface TreeContext {
  filter?: string;
}

export interface TreeNode {
  id: string;
  label: string;
  icon?: string;
  resource?: ResourceRef;
  menuPath?: MenuPath;
  menuPlacement?: "top-start" | "top-end" | "bottom-start" | "bottom-end" | "right-start" | "left-start";
  collapsible?: boolean;
  children?: TreeNode[];
  description?: string;
  contextValue?: string;
}

export interface TreeViewSection {
  id: string;
  label?: string;
  nodes: TreeNode[];
}

export type TreeViewRole = "primary" | "footer";

export interface TreeViewContribution {
  id: string;
  title: string;
  area?: Extract<ShellArea, "left" | "main-left" | "main-right" | "main-bottom">;
  role?: TreeViewRole;
  icon?: string;
  when?: string;
  getSections?(ctx: TreeContext): Promise<TreeViewSection[]> | TreeViewSection[];
  getRoots(ctx: TreeContext): Promise<TreeNode[]> | TreeNode[];
  getChildren(node: TreeNode, ctx: TreeContext): Promise<TreeNode[]> | TreeNode[];
}

export interface RegisteredTreeViewContribution extends TreeViewContribution, RegisteredContributionMetadata {}

export interface TreeViewState {
  expandedNodeIds: string[];
  selectedNodeId?: string;
}

export interface TreeViewRefreshEvent {
  treeViewId: string;
}

type TreeViewRefreshListener = (event: TreeViewRefreshEvent) => void;

export const createTreeViewRegistry = () => {
  const views = new Map<string, RegisteredTreeViewContribution>();
  const states = new Map<string, { expandedNodeIds: Set<string>; selectedNodeId?: string }>();
  const refreshListeners = new Set<TreeViewRefreshListener>();

  const findView = (id: string) => {
    const view = views.get(id);
    if (!view) throw new Error(`Tree view not registered: ${id}`);
    return view;
  };

  const findState = (id: string) => {
    findView(id);

    let state = states.get(id);
    if (!state) {
      state = { expandedNodeIds: new Set() };
      states.set(id, state);
    }

    return state;
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
        if (views.get(view.id) === record) {
          views.delete(view.id);
          states.delete(view.id);
        }
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

    async getSections(id: string, ctx: TreeContext = {}) {
      const view = findView(id);
      if (view.getSections) return await view.getSections(ctx);

      return [{ id: view.id, nodes: await view.getRoots(ctx) }];
    },

    async getChildren(id: string, node: TreeNode, ctx: TreeContext = {}) {
      return await findView(id).getChildren(node, ctx);
    },

    getViewState(id: string): TreeViewState {
      const state = findState(id);
      return {
        expandedNodeIds: [...state.expandedNodeIds],
        selectedNodeId: state.selectedNodeId,
      };
    },

    setNodeExpanded(id: string, nodeId: string, expanded: boolean) {
      const state = findState(id);
      if (expanded) {
        state.expandedNodeIds.add(nodeId);
      } else {
        state.expandedNodeIds.delete(nodeId);
      }
    },

    setSelectedNode(id: string, nodeId: string | undefined) {
      findState(id).selectedNodeId = nodeId;
    },

    refresh(id: string) {
      findView(id);
      const event = { treeViewId: id };
      for (const listener of refreshListeners) listener(event);
    },

    onDidRefresh(listener: TreeViewRefreshListener) {
      refreshListeners.add(listener);

      return createDisposable(() => {
        refreshListeners.delete(listener);
      });
    },
  };
};

export type TreeViewRegistry = ReturnType<typeof createTreeViewRegistry>;
