import type { TreeNode, TreeNodePage } from "../../../core";
import {
  createRendererQueryCache,
  type RendererQueryIdentity,
} from "../../../core/registries/views/renderer-query-cache";
import type { RendererReadRequest } from "../../../core/registries/views/renderer-read-registry";
import { createTreePages, type TreePageRead } from "./tree-pages";
import type { LoadedTreeData } from "./tree-view-load";

type Cache = ReturnType<typeof createRendererQueryCache>;
type Root = NonNullable<ReturnType<Cache["get"]>>;
export type PagedTreeData = LoadedTreeData & { children: Record<string, TreeNode[]> };
export type TreePageIdentity = RendererQueryIdentity & Pick<RendererReadRequest<unknown>, "queryEvents">;
interface PageJob {
  controller: AbortController;
  settled: Promise<unknown>;
  generation: number;
  epoch: number;
}
const owners = new WeakMap<object, ReturnType<typeof createOwner>>();
// Only actual outstanding children live here, so exact root retirement cannot admit an overlapping replacement.
const pending = new WeakMap<object, Map<string, Set<PageJob>>>();
let nextRootGeneration = 0;

/** A bounded finite-query owner retains page projection/depth, never a presentation or a second query root. */
const createOwner = (root: Root, parentCache: Cache, identity: TreePageIdentity) => {
  const rootGeneration = ++nextRootGeneration;
  const cache = createRendererQueryCache(parentCache.queries);
  const attachments = new Map<symbol, { listener(): void; cache: Cache }>();
  const running = new Set<PageJob>();
  const runtimeJobs = pending.get(parentCache.queries) ?? new Map<string, Set<PageJob>>();
  pending.set(parentCache.queries, runtimeJobs);
  const jobKey = JSON.stringify(root.query.key);
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
  const abortRunning = () => {
    for (const read of running) read.controller.abort();
  };
  const suspend = () => {
    generation.abort();
    abortRunning();
  };
  const stopInvalidation = root.query.subscribeInvalidation(suspend);
  const readPage = (input: TreePageRead): Promise<TreeNodePage> => {
    if (input.signal.aborted || !available())
      return Promise.reject(new DOMException("Tree cursor is suspended", "AbortError"));
    const controller = new AbortController();
    const abort = () => controller.abort();
    input.signal.addEventListener("abort", abort, { once: true });
    const siblings = runtimeJobs.get(jobKey) ?? new Set<PageJob>();
    runtimeJobs.set(jobKey, siblings);
    const previous = [...siblings]
      .filter((entry) => entry.generation !== rootGeneration || entry.epoch !== epoch)
      .map((entry) => entry.settled);
    const issued = epoch;
    const settled = Promise.resolve().then(async () => {
      await Promise.allSettled(previous);
      controller.signal.throwIfAborted();
      if (issued !== epoch || !available()) throw new DOMException("Tree cursor is suspended", "AbortError");
      const value = await cache.read<TreeNodePage>(
        {
          ...identity,
          queryKey: JSON.stringify([identity.queryKey, "tree-page", rootGeneration, issued, input.key, input.depth]),
          load: input.load,
          onValue() {},
          onError() {},
        },
        controller.signal,
        () => {},
      );
      controller.signal.throwIfAborted();
      if (issued !== epoch || !available()) throw new DOMException("Tree cursor is suspended", "AbortError");
      return value;
    });
    const entry = { controller, settled, generation: rootGeneration, epoch: issued };
    running.add(entry);
    siblings.add(entry);
    for (const lifetime of new Set([...attachments.values()].map((entry) => entry.cache))) lifetime.track(settled);
    void settled
      .then(
        () => {},
        () => {},
      )
      .finally(() => {
        running.delete(entry);
        siblings.delete(entry);
        if (!siblings.size && runtimeJobs.get(jobKey) === siblings) runtimeJobs.delete(jobKey);
        input.signal.removeEventListener("abort", abort);
      });
    return settled;
  };
  const accept = (value: PagedTreeData, accepted: unknown) => {
    if (!available() || root.query.getSnapshot().data !== accepted) return;
    const sameSnapshot = snapshot === accepted && !generation.signal.aborted;
    if (!sameSnapshot) {
      const retained = pages.snapshot();
      suspend();
      generation = new AbortController();
      epoch++;
      pages = createTreePages(generation.signal, publish, retained, readPage);
      snapshot = accepted;
    }
    // Absence in another placement is not an authoritative empty lazy result. Explicit [] still replaces it.
    tree = sameSnapshot && tree ? { ...value, children: { ...tree.children, ...value.children } } : value;
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
    void cache.dispose();
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
      for (const job of running) lifetime.track(job.settled);
      let released = false;
      let stopLifetime: (() => void) | undefined;
      const release = () => {
        if (released) return;
        released = true;
        attachments.delete(token);
        stopQuery();
        stopAdmission();
        stopLifetime?.();
        if (!attachments.size) abortRunning();
      };
      stopLifetime = lifetime.onDispose(release);
      return release;
    },
    accept,
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
