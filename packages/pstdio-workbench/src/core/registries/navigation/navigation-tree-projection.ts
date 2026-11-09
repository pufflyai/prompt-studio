import type { TreeNode, TreeViewSection } from "../renderers/tree-renderer-types";
import { setNavigationTreeNodeSource, setNavigationTreeSectionResource } from "./navigation-tree-node-source";
import { projectNavigationTreePage } from "./navigation-tree-pages";
import type {
  NavigationTreeContext,
  NavigationTreeContribution,
  NavigationTreeOwner,
  NavigationTreeSlot,
} from "./navigation-tree-types";

// The owner's top-level section. Extensions add ungrouped entries here and use a labeled section for a named group.
export const navigationRootSectionId = "navigation.root";
// Each slot keeps its own root, so pinned header and footer rows never share a section id with the body.
export const navigationSlotRootSectionId = (slot: NavigationTreeSlot = "content") =>
  slot === "content" ? navigationRootSectionId : `navigation.${slot}`;

export const ownerId = (owner: NavigationTreeOwner) => `${owner.kind}:${owner.extensionId}:${owner.id}`;

export const scopedId = (scope: string | undefined, id: string) => (scope ? `${scope}:${id}` : id);

export const createNavigationTreeProjection = (
  registryToken: object,
  assertCurrent: (contribution: NavigationTreeContribution) => void,
) => {
  const projectNode = (
    node: TreeNode,
    contribution: NavigationTreeContribution,
    moveScope: string,
    context: NavigationTreeContext,
  ): TreeNode => {
    const projected: TreeNode = {
      ...node,
      id: scopedId(contribution.idScope, node.id),
      moveScope,
      // Mode rows are navigation links users may hide and arrange; page-owned level rows are data such as notes
      // or sessions, which keep the order their owner gives them unless a row opts in.
      canHide: node.canHide ?? contribution.owner.kind === "mode",
      canReorder: node.canReorder ?? contribution.owner.kind === "mode",
      children: node.children?.map((child) => projectNode(child, contribution, moveScope, context)),
      nextPage: projectNavigationTreePage(
        node.nextPage,
        (child) => projectNode(child, contribution, moveScope, context),
        () => assertCurrent(contribution),
      ),
    };
    setNavigationTreeNodeSource(projected, {
      contribution,
      node,
      resource: context.resource,
      projectId: context.projectId,
      registryToken,
    });
    return projected;
  };

  const projectSection = (
    section: TreeViewSection,
    contribution: NavigationTreeContribution,
    owner: NavigationTreeOwner,
    context: NavigationTreeContext,
  ): TreeViewSection => {
    const projected: TreeViewSection = {
      ...section,
      id:
        contribution.sourceExtensionId !== owner.extensionId && !section.label
          ? navigationSlotRootSectionId(contribution.slot)
          : scopedId(contribution.idScope, section.id),
      moveScope: ownerId(owner),
      canHide: section.canHide ?? true,
      canReorder: section.canReorder ?? true,
      nodes: section.nodes.map((node) => projectNode(node, contribution, ownerId(owner), context)),
      nextPage: projectNavigationTreePage(
        section.nextPage,
        (node) => projectNode(node, contribution, ownerId(owner), context),
        () => assertCurrent(contribution),
      ),
    };
    setNavigationTreeSectionResource(projected, context.resource);
    return projected;
  };

  return { projectNode, projectSection };
};
