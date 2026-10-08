import type { TreeNode } from "../renderers/tree-renderer-types";
import type { ResourceRef } from "../resources/resource-registry";
import type { NavigationTreeContribution } from "./navigation-tree-registry";

const sources = new WeakMap<
  TreeNode,
  {
    contribution: NavigationTreeContribution;
    registryToken: object;
    node: TreeNode;
    resource?: ResourceRef;
  }
>();

export const setNavigationTreeNodeSource = (
  node: TreeNode,
  source: NonNullable<ReturnType<typeof getNavigationTreeNodeSource>>,
) => {
  sources.set(node, source);
};
export const getNavigationTreeNodeSource = (node: TreeNode, registryToken?: object) => {
  const source = sources.get(node);
  return registryToken && source?.registryToken !== registryToken ? undefined : source;
};
