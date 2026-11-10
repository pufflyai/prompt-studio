import { isScopedQueryCancellation } from "@pstdio/sdk/extensions";
import type { TreeNode, TreeNodePage, TreePageLoader, TreePageStatus, TreeViewSection } from "../../../core";
import { TreeContinuationCancelled } from "./tree-continuation-reads";

export interface TreePageRead {
  key: string;
  depth: number;
  load: TreePageLoader;
  signal: AbortSignal;
}

interface PageState {
  key: string;
  firstPage: TreePageLoader;
  initialNodes: TreeNode[];
  /** Keep the old whole collection visible when an insertion shifts the first page's boundary. */
  retainedInitial?: TreeNode[];
  nodes: TreeNode[];
  freshNodes: TreeNode[];
  depth: number;
  targetDepth: number;
  nextPage?: TreePageLoader;
  status: TreePageStatus;
}

interface RetainedPage {
  initialNodes: TreeNode[];
  nodes: TreeNode[];
  depth: number;
}

/** One provider snapshot owns every continuation, including pages of newly appended children. */
export const createTreePages = (
  signal: AbortSignal,
  publish: () => void,
  retained = new Map<string, RetainedPage>(),
  read: (input: TreePageRead) => Promise<TreeNodePage> = (input) => input.load(input.signal),
) => {
  const states = new Map<string, PageState>();
  const stateFor = (firstPage: TreePageLoader, key: string, initialNodes: TreeNode[]) => {
    const state = states.get(key);
    if (state?.firstPage === firstPage) return state;
    const previous = state ? retainPage(state) : retained.get(key);
    const created: PageState = {
      key,
      firstPage,
      initialNodes,
      retainedInitial: previous?.depth ? previous.initialNodes : undefined,
      nodes: previous?.nodes ?? [],
      freshNodes: [],
      depth: 0,
      targetDepth: previous?.depth ?? 0,
      nextPage: firstPage,
      status: {
        loadMore: () => loadPageState(created, signal, publish, read),
      },
    };
    states.set(key, created);
    return created;
  };
  const nodes = (values: TreeNode[], childrenByNodeId: Record<string, TreeNode[]>): TreeNode[] =>
    values.map((node) => {
      const initialChildren = childrenByNodeId[node.id] ?? node.children;
      const state = node.nextPage ? stateFor(node.nextPage, `node:${node.id}`, initialChildren ?? []) : undefined;
      if (!initialChildren && !state) return node;
      const children = nodes(
        appendNodes(state?.retainedInitial ?? initialChildren ?? [], state?.nodes ?? []),
        childrenByNodeId,
      );
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
    findNode: (id: string, sections: TreeViewSection[], children: Record<string, TreeNode[]>) => {
      const visit = (nodes: TreeNode[]): TreeNode | undefined => {
        for (const node of nodes) {
          if (node.id === id) return node;
          const found = visit(children[node.id] ?? node.children ?? []);
          if (found) return found;
        }
      };
      return visit([
        ...sections.flatMap((section) => section.nodes),
        ...[...states.values()].flatMap((state) => state.freshNodes),
      ]);
    },
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
        const state = section.nextPage ? stateFor(section.nextPage, `section:${section.id}`, section.nodes) : undefined;
        const children = nodes(
          appendNodes(state?.retainedInitial ?? section.nodes, state?.nodes ?? []),
          childrenByNodeId,
        );
        if (!state && children.every((child, index) => child === section.nodes[index])) return section;
        return { ...section, nodes: children, pagination: state?.nextPage ? state.status : undefined };
      });
      return next.every((section, index) => section === sections[index]) ? sections : next;
    },
  };
};

const retainPage = (state: PageState) => ({
  initialNodes: state.retainedInitial ?? state.initialNodes,
  nodes: state.nodes,
  depth: Math.max(state.depth, state.targetDepth),
});

const loadPageState = async (
  state: PageState,
  signal: AbortSignal,
  publish: () => void,
  read: (input: TreePageRead) => Promise<TreeNodePage>,
) => {
  if (signal.aborted || state.status.loading || !state.nextPage) return;
  state.status = { ...state.status, loading: true, error: undefined };
  publish();
  try {
    do {
      const page = await read({ key: state.key, depth: state.depth, load: state.nextPage, signal });
      signal.throwIfAborted();
      state.freshNodes = appendNodes(state.freshNodes, page.nodes);
      state.nextPage = page.nextPage;
      state.depth++;
    } while (state.nextPage && state.depth < state.targetDepth);
    state.nodes = state.freshNodes;
    state.retainedInitial = undefined;
  } catch (error) {
    if (!signal.aborted && !isScopedQueryCancellation(error) && !(error instanceof TreeContinuationCancelled))
      state.status = { ...state.status, error: pageError(error) };
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
