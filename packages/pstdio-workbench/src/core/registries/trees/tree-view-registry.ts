import type { ContributionMetadata, RegisteredContributionMetadata } from "../../shared/contributions/metadata";
import { byContributionPriority, normalizeContributionMetadata } from "../../shared/contributions/metadata";
import { createDisposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import type { WorkbenchArea, WorkbenchAreaSize } from "../layout/layout-model";
import type { MenuPath } from "../menus/menu-registry";
import type { ResourceRef } from "../resources/resource-registry";

export interface TreeContext {
  filter?: string;
}

export interface TreeAction {
  id: string;
  label?: string;
  icon?: string;
  commandId?: string;
  args?: unknown;
  when?: string;
  disabled?: boolean;
  run?(): Promise<void> | void;
}

export interface TreeNode {
  id: string;
  label: string;
  icon?: string;
  iconElement?: unknown;
  iconColor?: string;
  iconTooltip?: string;
  resource?: ResourceRef;
  actions?: TreeAction[];
  contextMenuActions?: TreeAction[];
  contextMenuPath?: MenuPath;
  menuPath?: MenuPath;
  menuPlacement?: "top-start" | "top-end" | "bottom-start" | "bottom-end" | "right-start" | "left-start";
  collapsible?: boolean;
  disabled?: boolean;
  children?: TreeNode[];
  description?: string;
  contextValue?: string;
}

export interface TreeViewSection {
  id: string;
  label?: string;
  actions?: TreeAction[];
  collapsible?: boolean;
  nodes: TreeNode[];
}

export type TreeViewRole = "primary" | "footer";

export interface TreeViewContribution {
  id: string;
  title: string;
  area?: Extract<WorkbenchArea, "left" | "main-left" | "main-right" | "main-bottom">;
  areaSize?: WorkbenchAreaSize;
  role?: TreeViewRole;
  icon?: string;
  when?: string;
  defaultExpandedSectionIds?: string[];
  defaultExpandedNodeIds?: string[];
  getSections?(ctx: TreeContext): Promise<TreeViewSection[]> | TreeViewSection[];
  getRoots(ctx: TreeContext): Promise<TreeNode[]> | TreeNode[];
  getChildren(node: TreeNode, ctx: TreeContext): Promise<TreeNode[]> | TreeNode[];
}

export interface RegisteredTreeViewContribution extends TreeViewContribution, RegisteredContributionMetadata {}

export interface TreeViewState {
  expandedNodeIds: string[];
  expandedSectionIds: string[];
  selectedNodeId?: string;
  loading?: boolean;
}

export interface TreeViewRefreshEvent {
  treeViewId: string;
}

export interface TreeViewStoreState {
  views: Record<string, RegisteredTreeViewContribution>;
  statesByViewId: Record<string, TreeViewState>;
  refreshKeysByViewId: Record<string, number>;
}

export interface PersistedTreeViewStates {
  statesByViewId: Record<string, TreeViewState>;
}

export interface TreeViewPersistenceAdapter {
  getTreeStates(): PersistedTreeViewStates | undefined;
  setTreeStates(states: PersistedTreeViewStates): void;
}

export interface CreateTreeViewRegistryInput {
  persistence?: TreeViewPersistenceAdapter;
}

type TreeViewRefreshListener = (event: TreeViewRefreshEvent) => void;

const createDefaultState = (view: TreeViewContribution): TreeViewState => ({
  expandedNodeIds: [...(view.defaultExpandedNodeIds ?? [])],
  expandedSectionIds: [...(view.defaultExpandedSectionIds ?? [])],
});

const toggleId = (ids: string[], id: string, expanded: boolean) => {
  if (expanded) return ids.includes(id) ? ids : [...ids, id];
  return ids.includes(id) ? ids.filter((value) => value !== id) : ids;
};

export interface TreeViewRegistry {
  store: WorkbenchStore<TreeViewStoreState>;
  registerTreeView(view: TreeViewContribution, metadata?: ContributionMetadata): { dispose(): void };
  getTreeView(id: string): RegisteredTreeViewContribution | undefined;
  listTreeViews(): RegisteredTreeViewContribution[];
  getRoots(id: string, ctx?: TreeContext): Promise<TreeNode[]>;
  getSections(id: string, ctx?: TreeContext): Promise<TreeViewSection[]>;
  getChildren(id: string, node: TreeNode, ctx?: TreeContext): Promise<TreeNode[]>;
  getViewState(id: string): TreeViewState;
  setNodeExpanded(id: string, nodeId: string, expanded: boolean): void;
  setSectionExpanded(id: string, sectionId: string, expanded: boolean): void;
  setSelectedNode(id: string, nodeId: string | undefined): void;
  setLoading(id: string, loading: boolean): void;
  refresh(id: string): void;
  onDidRefresh(listener: TreeViewRefreshListener): { dispose(): void };
}

export const createTreeViewRegistry = (input: CreateTreeViewRegistryInput = {}): TreeViewRegistry => {
  const persisted = input.persistence?.getTreeStates();

  const store = createWorkbenchStore<TreeViewStoreState>({
    name: "workbench.trees",
    initialState: {
      views: {},
      statesByViewId: persisted?.statesByViewId ?? {},
      refreshKeysByViewId: {},
    },
  });

  const refreshListeners = new Set<TreeViewRefreshListener>();

  const requireView = (id: string) => {
    const view = store.getState().views[id];
    if (!view) throw new Error(`Tree view not registered: ${id}`);
    return view;
  };

  const ensureState = (id: string) => {
    const current = store.getState();
    const existing = current.statesByViewId[id];
    if (existing) return existing;

    const view = current.views[id];
    if (!view) throw new Error(`Tree view not registered: ${id}`);

    const fresh = createDefaultState(view);
    store.setState(
      {
        ...current,
        statesByViewId: { ...current.statesByViewId, [id]: fresh },
      },
      false,
      "ensureViewState",
    );
    return fresh;
  };

  const persistStates = () => {
    if (!input.persistence) return;
    const statesByViewId: Record<string, TreeViewState> = {};
    for (const [id, state] of Object.entries(store.getState().statesByViewId)) {
      const { loading: _loading, ...persistable } = state;
      statesByViewId[id] = persistable;
    }
    input.persistence.setTreeStates({ statesByViewId });
  };

  const updateState = (id: string, update: (state: TreeViewState) => TreeViewState, action: string) => {
    const current = ensureState(id);
    const next = update(current);
    if (next === current) return;

    const snapshot = store.getState();
    store.setState(
      {
        ...snapshot,
        statesByViewId: { ...snapshot.statesByViewId, [id]: next },
      },
      false,
      action,
    );
    persistStates();
  };

  return {
    store,

    registerTreeView(view, metadata) {
      const snapshot = store.getState();
      if (snapshot.views[view.id]) throw new Error(`Tree view already registered: ${view.id}`);

      const record: RegisteredTreeViewContribution = {
        ...normalizeContributionMetadata(metadata),
        ...view,
      };

      store.setState(
        {
          ...snapshot,
          views: { ...snapshot.views, [view.id]: record },
        },
        false,
        "registerTreeView",
      );

      return createDisposable(() => {
        const current = store.getState();
        if (current.views[view.id] !== record) return;
        const { [view.id]: _removed, ...nextViews } = current.views;
        const { [view.id]: _removedState, ...nextStates } = current.statesByViewId;
        const { [view.id]: _removedRefresh, ...nextRefresh } = current.refreshKeysByViewId;
        store.setState(
          {
            views: nextViews,
            statesByViewId: nextStates,
            refreshKeysByViewId: nextRefresh,
          },
          false,
          "unregisterTreeView",
        );
        persistStates();
      });
    },

    getTreeView(id) {
      return store.getState().views[id];
    },

    listTreeViews() {
      return Object.values(store.getState().views).sort(byContributionPriority);
    },

    async getRoots(id, ctx = {}) {
      return await requireView(id).getRoots(ctx);
    },

    async getSections(id, ctx = {}) {
      const view = requireView(id);
      if (view.getSections) return await view.getSections(ctx);
      return [{ id: view.id, nodes: await view.getRoots(ctx) }];
    },

    async getChildren(id, node, ctx = {}) {
      return await requireView(id).getChildren(node, ctx);
    },

    getViewState(id) {
      const state = ensureState(id);
      return {
        expandedNodeIds: [...state.expandedNodeIds],
        expandedSectionIds: [...state.expandedSectionIds],
        selectedNodeId: state.selectedNodeId,
        loading: state.loading,
      };
    },

    setNodeExpanded(id, nodeId, expanded) {
      requireView(id);
      updateState(
        id,
        (state) => {
          const nextIds = toggleId(state.expandedNodeIds, nodeId, expanded);
          if (nextIds === state.expandedNodeIds) return state;
          return { ...state, expandedNodeIds: nextIds };
        },
        "setNodeExpanded",
      );
    },

    setSectionExpanded(id, sectionId, expanded) {
      requireView(id);
      updateState(
        id,
        (state) => {
          const nextIds = toggleId(state.expandedSectionIds, sectionId, expanded);
          if (nextIds === state.expandedSectionIds) return state;
          return { ...state, expandedSectionIds: nextIds };
        },
        "setSectionExpanded",
      );
    },

    setSelectedNode(id, nodeId) {
      requireView(id);
      updateState(
        id,
        (state) => {
          if (state.selectedNodeId === nodeId) return state;
          return { ...state, selectedNodeId: nodeId };
        },
        "setSelectedNode",
      );
    },

    setLoading(id, loading) {
      requireView(id);
      const current = ensureState(id);
      if (current.loading === loading) return;

      const snapshot = store.getState();
      store.setState(
        {
          ...snapshot,
          statesByViewId: { ...snapshot.statesByViewId, [id]: { ...current, loading } },
        },
        false,
        "setLoading",
      );
    },

    refresh(id) {
      requireView(id);
      const snapshot = store.getState();
      const current = snapshot.refreshKeysByViewId[id] ?? 0;
      store.setState(
        {
          ...snapshot,
          refreshKeysByViewId: { ...snapshot.refreshKeysByViewId, [id]: current + 1 },
        },
        false,
        "refreshTreeView",
      );
      const event = { treeViewId: id };
      for (const listener of refreshListeners) listener(event);
    },

    onDidRefresh(listener) {
      refreshListeners.add(listener);
      return createDisposable(() => {
        refreshListeners.delete(listener);
      });
    },
  };
};
