import type { TreeNode } from "../../../core";
import type {
  createRendererQueryCache,
  RendererQueryIdentity,
} from "../../../core/registries/views/renderer-query-cache";
import type { RendererReadRequest } from "../../../core/registries/views/renderer-read-registry";
import { createTreeChildOwner } from "./tree-child-owner";
import { createTreeContinuationReads } from "./tree-continuation-reads";
import { createTreePages, type TreePageRead } from "./tree-pages";
import type { LoadedTreeData } from "./tree-view-load";

type Cache = ReturnType<typeof createRendererQueryCache>;
type Root = NonNullable<ReturnType<Cache["get"]>>;
export type PagedTreeData = LoadedTreeData & { children: Record<string, TreeNode[]> };
export type TreePageIdentity = RendererQueryIdentity & Pick<RendererReadRequest<unknown>, "queryEvents">;
const owners = new WeakMap<object, ReturnType<typeof createOwner>>();

/** A bounded finite-query owner retains page projection/depth, never a presentation or a second query root. */
const createOwner = (root: Root, parentCache: Cache, identity: TreePageIdentity) => {
  const attachments = new Map<symbol, { listener(): void; cache: Cache }>();
  let tree: PagedTreeData | undefined;
  let snapshot: unknown;
  let generation = new AbortController();
  let epoch = 0;
  let pages = createTreePages(generation.signal, publish);
  function publish() {
    for (const { listener } of attachments.values()) listener();
  }
  const available = () =>
    attachments.size > 0 &&
    !root.query.isDisposed() &&
    !root.query.inspect().stale &&
    !root.query.getSnapshot().error &&
    !root.admission.held();
  const reads = createTreeContinuationReads(root.query.key, parentCache, identity, {
    epoch: () => epoch,
    available,
    lifetimes: () => [...attachments.values()].map((entry) => entry.cache),
  });
  const suspend = () => {
    generation.abort();
    reads.abort();
  };
  const stopInvalidation = root.query.subscribeInvalidation(suspend);
  const readPage = (input: TreePageRead) => reads.read(["page", input.key, input.depth], input.load, input.signal);
  const node = (id: string) =>
    tree && pages.findNode(id, [...tree.header, ...tree.body, ...tree.footer], tree.children);
  const createChildren = () =>
    createTreeChildOwner({
      node,
      loaded: (id) => Boolean(node(id)?.children || (tree && Object.hasOwn(tree.children, id))),
      signal: () => generation.signal,
      available,
      onCancelled: publish,
      read: (id, load, signal) => reads.read(["children", id], load, signal),
      accept: (id, nodes) => {
        if (!tree) return;
        tree = { ...tree, children: { ...tree.children, [id]: nodes } };
        publish();
      },
    });
  let children = createChildren();
  const accept = (value: PagedTreeData, accepted: unknown) => {
    if (!available() || root.query.getSnapshot().data !== accepted) return false;
    const sameSnapshot = snapshot === accepted && !generation.signal.aborted;
    if (!sameSnapshot) {
      const retained = pages.snapshot();
      suspend();
      generation = new AbortController();
      epoch++;
      children = createChildren();
      pages = createTreePages(generation.signal, publish, retained, readPage);
      snapshot = accepted;
    }
    // Absence in another placement is not an authoritative empty lazy result. Explicit [] still replaces it.
    tree = sameSnapshot && tree ? { ...value, children: { ...tree.children, ...value.children } } : value;
    return true;
  };
  let retired = false;
  const retire = () => {
    if (retired) return;
    retired = true;
    suspend();
    tree = undefined;
    snapshot = undefined;
    stopInvalidation();
    stopRetirement();
    void reads.dispose();
    publish();
  };
  const stopRetirement = parentCache.queries.subscribeRetirement(() => {
    if (root.query.isDisposed()) retire();
  });
  const rootChanged = () => {
    if (root.query.isDisposed()) {
      retire();
      return;
    }
    const next = root.query.getSnapshot();
    if (
      !next.fetching &&
      available() &&
      next.data !== undefined &&
      (snapshot !== next.data || generation.signal.aborted)
    ) {
      accept(next.data as PagedTreeData, next.data);
      publish();
    }
  };
  return {
    attach(listener: () => void, lifetime = parentCache) {
      if (lifetime.isDisposed()) return () => {};
      const token = Symbol();
      attachments.set(token, { listener, cache: lifetime });
      const stopQuery = root.query.subscribe(rootChanged, { automatic: false });
      const stopAdmission = root.admission.subscribe(() => {
        if (root.admission.held()) suspend();
      });
      reads.track(lifetime);
      let released = false;
      let stopLifetime: (() => void) | undefined;
      const release = () => {
        if (released) return;
        released = true;
        attachments.delete(token);
        stopQuery();
        stopAdmission();
        stopLifetime?.();
        if (!attachments.size) reads.abort();
      };
      stopLifetime = lifetime.onDispose(release);
      return release;
    },
    accept,
    loadChildren: (id: string, load: (node: TreeNode, signal: AbortSignal) => Promise<TreeNode[]>, retry?: boolean) =>
      children.load(id, load, retry),
    sections() {
      return (
        tree && {
          body: pages.sections(tree.body, tree.children),
          header: pages.sections(tree.header, tree.children),
          footer: pages.sections(tree.footer, tree.children),
        }
      );
    },
    revalidate(visible: Set<string>) {
      return available() && !generation.signal.aborted ? pages.revalidate(visible) : Promise.resolve();
    },
  };
};

/** Acquire only after commit; abandoned presentations neither pin queries nor create controllers. */
export const getTreePageOwner = (cache: Cache, identity: TreePageIdentity) => {
  const root = cache.get(identity);
  if (!root) return;
  let owner = owners.get(root.query);
  if (!owner) {
    owner = createOwner(root, cache, identity);
    owners.set(root.query, owner);
  }
  return owner;
};
