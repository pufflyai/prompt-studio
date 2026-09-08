import { byContributionPriority, normalizeContributionMetadata } from "../../shared/contributions/metadata";
import { createDisposable } from "../../shared/disposable";
import { createWorkbenchStore } from "../../shared/store/workbench-store";
import type {
  CreateTreeRendererRegistryInput,
  RegisteredTreeRendererContribution,
  TreeRendererContribution,
  TreeRendererImplementation,
  TreeRendererRefreshListener,
  TreeRendererRegistry,
  TreeRendererState,
  TreeRendererStoreState,
} from "./tree-renderer-types";

export type * from "./tree-renderer-types";

const createDefaultState = (view: TreeRendererContribution): TreeRendererState => ({
  expandedNodeIds: [...(view.defaultExpandedNodeIds ?? [])],
  expandedSectionIds: [...(view.defaultExpandedSectionIds ?? [])],
});

// Section defaults are re-applied on every registration so a section that
// should start expanded (e.g. a ticket's workspaces) stays expanded even when
// an older persisted state predates it. Node expansion stays user-controlled.
const mergeDefaultSections = (state: TreeRendererState, view: TreeRendererContribution): TreeRendererState => {
  const missing = (view.defaultExpandedSectionIds ?? []).filter((id) => !state.expandedSectionIds.includes(id));
  if (missing.length === 0) return state;
  return { ...state, expandedSectionIds: [...state.expandedSectionIds, ...missing] };
};

const toggleId = (ids: string[], id: string, expanded: boolean) => {
  if (expanded) return ids.includes(id) ? ids : [...ids, id];
  return ids.includes(id) ? ids.filter((value) => value !== id) : ids;
};

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

  const registry: TreeRendererRegistry = {
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
      const persistedState = snapshot.statesByTreeId[view.id];
      const nextState = persistedState ? mergeDefaultSections(persistedState, view) : createDefaultState(view);

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
      return await requireTree(id).getBody({
        ...ctx,
        state: registry.getTreeState(id),
        refresh: () => registry.refresh(id),
        setSelectedNode: (nodeId) => registry.setSelectedNode(id, nodeId),
      });
    },

    async getHeader(id, ctx = {}) {
      const tree = requireTree(id);
      if (!tree.getHeader) return [];
      return await tree.getHeader({
        ...ctx,
        state: registry.getTreeState(id),
        refresh: () => registry.refresh(id),
        setSelectedNode: (nodeId) => registry.setSelectedNode(id, nodeId),
      });
    },

    async getFooter(id, ctx = {}) {
      const tree = requireTree(id);
      if (!tree.getFooter) return [];
      return await tree.getFooter({
        ...ctx,
        state: registry.getTreeState(id),
        refresh: () => registry.refresh(id),
        setSelectedNode: (nodeId) => registry.setSelectedNode(id, nodeId),
      });
    },

    async getChildren(id, node, ctx = {}) {
      return await requireTree(id).getChildren(node, {
        ...ctx,
        state: registry.getTreeState(id),
        refresh: () => registry.refresh(id),
        setSelectedNode: (nodeId) => registry.setSelectedNode(id, nodeId),
      });
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
  return registry;
};
