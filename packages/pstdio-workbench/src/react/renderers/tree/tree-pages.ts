import type { TreeNode, TreeNodePage, TreePageLoader, TreePageStatus, TreeViewSection } from "../../../core";

interface PageState {
  firstPage: TreePageLoader;
  nodes: TreeNode[];
  freshNodes: TreeNode[];
  depth: number;
  targetDepth: number;
  nextPage?: TreePageLoader;
  status: TreePageStatus;
}

interface RetainedPage {
  nodes: TreeNode[];
  depth: number;
}

/** One provider snapshot owns every continuation, including pages of newly appended children. */
export const createTreePages = (
  signal: AbortSignal,
  publish: () => void,
  retained = new Map<string, RetainedPage>(),
) => {
  const states = new Map<string, PageState>();
  const stateFor = (firstPage: TreePageLoader, key: string) => {
    const state = states.get(key);
    if (state?.firstPage === firstPage) return state;
    const previous = state ? retainPage(state) : retained.get(key);
    const created: PageState = {
      firstPage,
      nodes: previous?.nodes ?? [],
      freshNodes: [],
      depth: 0,
      targetDepth: previous?.depth ?? 0,
      nextPage: firstPage,
      status: {
        loadMore: () => loadPageState(created, signal, publish),
      },
    };
    states.set(key, created);
    return created;
  };
  const nodes = (values: TreeNode[], childrenByNodeId: Record<string, TreeNode[]>): TreeNode[] =>
    values.map((node) => {
      const state = node.nextPage ? stateFor(node.nextPage, `node:${node.id}`) : undefined;
      const initialChildren = childrenByNodeId[node.id] ?? node.children;
      if (!initialChildren && !state) return node;
      const children = nodes(appendNodes(initialChildren ?? [], state?.nodes ?? []), childrenByNodeId);
      const pagination = state?.nextPage ? state.status : undefined;
      if (
        !state &&
        node.children &&
        children.length === node.children.length &&
        children.every((child, index) => child === node.children?.[index])
      )
        return node;
      return { ...node, children, pagination };
    });
  return {
    snapshot: () => new Map([...states].map(([key, state]) => [key, retainPage(state)])),
    revalidate: async (visible = new Set(states.keys())) => {
      await Promise.all(
        [...states.entries()]
          .filter(([key, state]) => visible.has(key) && state.depth < state.targetDepth && !state.status.error)
          .map(([, state]) => state)
          .map((state) => state.status.loadMore()),
      );
    },
    sections: (sections: TreeViewSection[], childrenByNodeId: Record<string, TreeNode[]> = {}) => {
      const next = sections.map((section) => {
        const state = section.nextPage ? stateFor(section.nextPage, `section:${section.id}`) : undefined;
        const children = nodes(appendNodes(section.nodes, state?.nodes ?? []), childrenByNodeId);
        if (!state && children.every((child, index) => child === section.nodes[index])) return section;
        return { ...section, nodes: children, pagination: state?.nextPage ? state.status : undefined };
      });
      return next.every((section, index) => section === sections[index]) ? sections : next;
    },
  };
};

const retainPage = (state: PageState) => ({ nodes: state.nodes, depth: Math.max(state.depth, state.targetDepth) });

const loadPageState = async (state: PageState, signal: AbortSignal, publish: () => void) => {
  if (signal.aborted || state.status.loading || !state.nextPage) return;
  state.status = { ...state.status, loading: true, error: undefined };
  publish();
  try {
    do {
      const page: TreeNodePage = await state.nextPage(signal);
      signal.throwIfAborted();
      state.freshNodes = appendNodes(state.freshNodes, page.nodes);
      state.nextPage = page.nextPage;
      state.depth++;
    } while (state.nextPage && state.depth < state.targetDepth);
    state.nodes = state.freshNodes;
  } catch (error) {
    if (!signal.aborted) state.status = { ...state.status, error: pageError(error) };
  } finally {
    if (!signal.aborted) {
      state.status = { ...state.status, loading: false };
      publish();
    }
  }
};

const pageError = (error: unknown) => (error instanceof Error ? error.message : String(error));

const appendNodes = (existing: TreeNode[], incoming: TreeNode[]) => {
  if (!incoming.length) return existing;
  const ids = new Set(existing.map((node) => node.id));
  return [
    ...existing,
    ...incoming.filter((node) => {
      if (ids.has(node.id)) return false;
      ids.add(node.id);
      return true;
    }),
  ];
};
