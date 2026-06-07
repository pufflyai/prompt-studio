import type { ContributionMetadata, RegisteredContributionMetadata } from "../../shared/contributions/metadata";
import { byContributionPriority, normalizeContributionMetadata } from "../../shared/contributions/metadata";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import type { CommandParamSchema } from "../commands/command-registry";
import type { MenuPath } from "../menus/menu-registry";
import type { NavigationTarget } from "../navigation/navigation-registry";
import type { ResourceRef } from "../resources/resource-registry";
import type { WorkbenchRendererRegistry, WorkbenchWidgetRenderInput } from "./renderer-registry";

export interface TreeContext {
  filter?: string;
  resource?: ResourceRef;
}

export interface TreeAction {
  id: string;
  label?: string;
  icon?: string;
  commandId?: string;
  args?: unknown;
  params?: CommandParamSchema;
  when?: string;
  disabled?: boolean;
  run?(args?: unknown): Promise<void> | void;
}

export interface TreeNode {
  id: string;
  label: string;
  icon?: string;
  iconElement?: unknown;
  iconColor?: string;
  iconTooltip?: string;
  resource?: ResourceRef;
  target?: NavigationTarget;
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
  hiddenByDefault?: boolean;
}

export interface TreeViewSection {
  id: string;
  label?: string;
  actions?: TreeAction[];
  collapsible?: boolean;
  nodes: TreeNode[];
  hiddenByDefault?: boolean;
}

export interface TreeRendererContribution {
  id: string;
  title: string;
  icon?: string;
  when?: string;
  defaultExpandedSectionIds?: string[];
  defaultExpandedNodeIds?: string[];
  getBody(ctx: TreeContext): Promise<TreeViewSection[]> | TreeViewSection[];
  getFooter?(ctx: TreeContext): Promise<TreeNode[]> | TreeNode[];
  getChildren(node: TreeNode, ctx: TreeContext): Promise<TreeNode[]> | TreeNode[];
}

export interface RegisteredTreeRendererContribution extends TreeRendererContribution, RegisteredContributionMetadata {}

export interface TreeRendererState {
  expandedNodeIds: string[];
  expandedSectionIds: string[];
  selectedNodeId?: string;
  loading?: boolean;
}

export interface TreeRendererRefreshEvent {
  treeId: string;
}

export interface TreeRendererStoreState {
  trees: Record<string, RegisteredTreeRendererContribution>;
  statesByTreeId: Record<string, TreeRendererState>;
  refreshKeysByTreeId: Record<string, number>;
}

export interface PersistedTreeRendererStates {
  statesByTreeId: Record<string, TreeRendererState>;
}

export interface TreeRendererPersistenceAdapter {
  getTreeStates(): PersistedTreeRendererStates | undefined;
  setTreeStates(states: PersistedTreeRendererStates): void;
}

// The React layer supplies the actual rendering for a tree id when a widget
// references it. Set once on workbench mount via setTreeRendererImplementation
// so registerTreeRenderer can auto-register a renderer entry with the same id.
export type TreeRendererImplementation = (input: WorkbenchWidgetRenderInput & { treeId: string }) => unknown;

export interface CreateTreeRendererRegistryInput {
  rendererRegistry: WorkbenchRendererRegistry;
  persistence?: TreeRendererPersistenceAdapter;
}

type TreeRendererRefreshListener = (event: TreeRendererRefreshEvent) => void;

const createDefaultState = (view: TreeRendererContribution): TreeRendererState => ({
  expandedNodeIds: [...(view.defaultExpandedNodeIds ?? [])],
  expandedSectionIds: [...(view.defaultExpandedSectionIds ?? [])],
});

const toggleId = (ids: string[], id: string, expanded: boolean) => {
  if (expanded) return ids.includes(id) ? ids : [...ids, id];
  return ids.includes(id) ? ids.filter((value) => value !== id) : ids;
};

export interface TreeRendererRegistry {
  treeStore: WorkbenchStore<TreeRendererStoreState>;
  registerTreeRenderer(view: TreeRendererContribution, metadata?: ContributionMetadata): Disposable;
  setTreeRendererImplementation(impl: TreeRendererImplementation): void;
  getTreeRenderer(id: string): RegisteredTreeRendererContribution | undefined;
  listTreeRenderers(): RegisteredTreeRendererContribution[];
  getBody(id: string, ctx?: TreeContext): Promise<TreeViewSection[]>;
  getFooter(id: string, ctx?: TreeContext): Promise<TreeNode[]>;
  getChildren(id: string, node: TreeNode, ctx?: TreeContext): Promise<TreeNode[]>;
  getTreeState(id: string): TreeRendererState;
  setNodeExpanded(id: string, nodeId: string, expanded: boolean): void;
  setSectionExpanded(id: string, sectionId: string, expanded: boolean): void;
  setSelectedNode(id: string, nodeId: string | undefined): void;
  setLoading(id: string, loading: boolean): void;
  refresh(id: string): void;
  onDidRefresh(listener: TreeRendererRefreshListener): Disposable;
}

export const createTreeRendererRegistry = (input: CreateTreeRendererRegistryInput): TreeRendererRegistry => {
  const { rendererRegistry, persistence } = input;
  const persisted = persistence?.getTreeStates();

  const treeStore = createWorkbenchStore<TreeRendererStoreState>({
    name: "workbench.treeRenderers",
    initialState: {
      trees: {},
      statesByTreeId: persisted?.statesByTreeId ?? {},
      refreshKeysByTreeId: {},
    },
  });

  const refreshListeners = new Set<TreeRendererRefreshListener>();
  let implementation: TreeRendererImplementation = () => null;

  const requireTree = (id: string) => {
    const tree = treeStore.getState().trees[id];
    if (!tree) throw new Error(`Tree renderer not registered: ${id}`);
    return tree;
  };

  const ensureState = (id: string) => {
    const current = treeStore.getState();
    const existing = current.statesByTreeId[id];
    if (existing) return existing;

    const tree = current.trees[id];
    if (!tree) throw new Error(`Tree renderer not registered: ${id}`);

    const fresh = createDefaultState(tree);
    treeStore.setState(
      {
        ...current,
        statesByTreeId: { ...current.statesByTreeId, [id]: fresh },
      },
      false,
      "ensureTreeState",
    );
    return fresh;
  };

  const persistStates = () => {
    if (!persistence) return;
    const statesByTreeId: Record<string, TreeRendererState> = {};
    for (const [id, state] of Object.entries(treeStore.getState().statesByTreeId)) {
      const { loading: _loading, ...persistable } = state;
      statesByTreeId[id] = persistable;
    }
    persistence.setTreeStates({ statesByTreeId });
  };

  const updateState = (id: string, update: (state: TreeRendererState) => TreeRendererState, action: string) => {
    const current = ensureState(id);
    const next = update(current);
    if (next === current) return;

    const snapshot = treeStore.getState();
    treeStore.setState(
      {
        ...snapshot,
        statesByTreeId: { ...snapshot.statesByTreeId, [id]: next },
      },
      false,
      action,
    );
    persistStates();
  };

  return {
    treeStore,

    setTreeRendererImplementation(impl) {
      implementation = impl;
    },

    registerTreeRenderer(view, metadata) {
      const snapshot = treeStore.getState();
      if (snapshot.trees[view.id]) throw new Error(`Tree renderer already registered: ${view.id}`);

      const record: RegisteredTreeRendererContribution = {
        ...normalizeContributionMetadata(metadata),
        ...view,
      };
      const nextState = snapshot.statesByTreeId[view.id] ?? createDefaultState(view);

      treeStore.setState(
        {
          ...snapshot,
          trees: { ...snapshot.trees, [view.id]: record },
          statesByTreeId: { ...snapshot.statesByTreeId, [view.id]: nextState },
        },
        false,
        "registerTreeRenderer",
      );

      // Auto-register a widget renderer with the same id so widgets can place
      // this tree via rendererId: view.id. The render fn calls the React-side
      // implementation supplied through setTreeRendererImplementation.
      const rendererDisposable = rendererRegistry.registerRenderer({
        id: view.id,
        render: (rendererInput) => implementation({ ...rendererInput, treeId: view.id }),
      });

      return createDisposable(() => {
        rendererDisposable.dispose();
        const current = treeStore.getState();
        if (current.trees[view.id] !== record) return;
        const { [view.id]: _removed, ...nextTrees } = current.trees;
        const { [view.id]: _removedState, ...nextStates } = current.statesByTreeId;
        const { [view.id]: _removedRefresh, ...nextRefresh } = current.refreshKeysByTreeId;
        treeStore.setState(
          {
            trees: nextTrees,
            statesByTreeId: nextStates,
            refreshKeysByTreeId: nextRefresh,
          },
          false,
          "unregisterTreeRenderer",
        );
        persistStates();
      });
    },

    getTreeRenderer(id) {
      return treeStore.getState().trees[id];
    },

    listTreeRenderers() {
      return Object.values(treeStore.getState().trees).sort(byContributionPriority);
    },

    async getBody(id, ctx = {}) {
      return await requireTree(id).getBody(ctx);
    },

    async getFooter(id, ctx = {}) {
      const tree = requireTree(id);
      if (!tree.getFooter) return [];
      return await tree.getFooter(ctx);
    },

    async getChildren(id, node, ctx = {}) {
      return await requireTree(id).getChildren(node, ctx);
    },

    getTreeState(id) {
      const state = ensureState(id);
      return {
        expandedNodeIds: [...state.expandedNodeIds],
        expandedSectionIds: [...state.expandedSectionIds],
        selectedNodeId: state.selectedNodeId,
        loading: state.loading,
      };
    },

    setNodeExpanded(id, nodeId, expanded) {
      requireTree(id);
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
      requireTree(id);
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
      requireTree(id);
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
      requireTree(id);
      const current = ensureState(id);
      if (current.loading === loading) return;

      const snapshot = treeStore.getState();
      treeStore.setState(
        {
          ...snapshot,
          statesByTreeId: { ...snapshot.statesByTreeId, [id]: { ...current, loading } },
        },
        false,
        "setLoading",
      );
    },

    refresh(id) {
      requireTree(id);
      const snapshot = treeStore.getState();
      const current = snapshot.refreshKeysByTreeId[id] ?? 0;
      treeStore.setState(
        {
          ...snapshot,
          refreshKeysByTreeId: { ...snapshot.refreshKeysByTreeId, [id]: current + 1 },
        },
        false,
        "refreshTreeRenderer",
      );
      const event = { treeId: id };
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
