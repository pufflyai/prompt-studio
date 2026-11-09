import type { QueryChangeEnvelope, ScopedQueryClient } from "@pstdio/sdk/extensions";
import type { TreeNode, TreeViewSection } from "../renderers/tree-renderer-types";
import { createRendererQueryCache, type RendererQueryIdentity } from "../views/renderer-query-cache";
import type { RendererReadRequest } from "../views/renderer-read-registry";
import { stableNavigationValue } from "./navigation-target-key";
import type { NavigationTreeContext, NavigationTreeContribution } from "./navigation-tree-types";

let nextRegistry = 0;
/** Navigation projects the common finite/progressive query owner, including its retention bound. */
export const createNavigationTreeSnapshots = (queries?: ScopedQueryClient, observeViews = false) => {
  const cache = createRendererQueryCache(queries);
  const registryId = ++nextRegistry;
  const sources = new WeakMap<NavigationTreeContribution, string>();
  let nextSource = 0;
  const sourceFor = (contribution: NavigationTreeContribution) => {
    let source = sources.get(contribution);
    if (!source) {
      source = `navigation:${registryId}:${++nextSource}:${contribution.id}`;
      sources.set(contribution, source);
    }
    return source;
  };
  const identity = (
    contribution: NavigationTreeContribution,
    context: NavigationTreeContext,
    node?: TreeNode,
  ): RendererQueryIdentity => ({
    sourceId: sourceFor(contribution),
    queryScope: { projectId: context.projectId, extensionId: contribution.sourceExtensionId },
    queryKey: JSON.stringify(stableNavigationValue([node ? "children" : "sections", context.resource, node])),
  });
  const read = <T>(
    contribution: NavigationTreeContribution,
    context: NavigationTreeContext,
    load: RendererReadRequest<T>["load"],
    publish: (value: T) => void,
    node?: TreeNode,
  ) => {
    const request: RendererReadRequest<T> = {
      ...identity(contribution, context, node),
      load,
      onValue: () => {},
      onError: () => {},
      // Legacy direct providers have no change contract. Reconcile on the next read while retaining warm rows.
      ...(contribution.viewId && observeViews ? {} : { subscribe: () => () => {} }),
    };
    return cache.read(request, context.signal ?? new AbortController().signal, publish);
  };
  return {
    get: (contribution: NavigationTreeContribution, context: NavigationTreeContext) =>
      cache.peek<TreeViewSection[]>(identity(contribution, context))?.data,
    readSections(
      contribution: NavigationTreeContribution,
      context: NavigationTreeContext,
      load: RendererReadRequest<TreeViewSection[]>["load"],
      publish: (value: TreeViewSection[]) => void,
    ) {
      const retained = cache.peek<TreeViewSection[]>(identity(contribution, context))?.data;
      return read(contribution, context, load, (value) => {
        if (retained === undefined) publish(value);
      });
    },
    readChildren(
      contribution: NavigationTreeContribution,
      node: TreeNode,
      context: NavigationTreeContext,
      load: RendererReadRequest<TreeNode[]>["load"],
    ) {
      return read(contribution, context, load, () => {}, node);
    },
    invalidate(contribution: NavigationTreeContribution, event?: QueryChangeEnvelope) {
      const source = sources.get(contribution);
      if (source) cache.invalidate(source, event);
    },
    delete(contribution: NavigationTreeContribution) {
      const source = sources.get(contribution);
      if (source) cache.remove(source);
    },
    dispose: cache.dispose,
  };
};
