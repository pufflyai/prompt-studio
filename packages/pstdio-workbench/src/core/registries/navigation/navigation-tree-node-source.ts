import type { TreeNode } from "../renderers/tree-renderer-types";
import type { ResourceRef } from "../resources/resource-registry";
import type { NavigationTreeContribution } from "./navigation-tree-registry";

interface NavigationTreeNodeSource {
  contribution: NavigationTreeContribution;
  registryToken: object;
  node: TreeNode;
  resource?: ResourceRef;
}
// Preview spreads retain ownership, while registry tokens still isolate independent registries.
const nodeSource = Symbol("navigationTreeNodeSource");
export const setNavigationTreeNodeSource = (node: TreeNode, source: NavigationTreeNodeSource) => {
  Object.assign(node, { [nodeSource]: source });
};
export const getNavigationTreeNodeSource = (node: TreeNode, registryToken?: object) => {
  const source = (node as TreeNode & { [nodeSource]?: NavigationTreeNodeSource })[nodeSource];
  return registryToken && source?.registryToken !== registryToken ? undefined : source;
};
