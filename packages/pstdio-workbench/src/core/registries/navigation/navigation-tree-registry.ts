import { createDisposable, type Disposable } from "../../shared/disposable";
import type { TreeNode, TreeViewSection } from "../renderers/tree-renderer-registry";
import type { ResourceRef } from "../resources/resource-registry";

export type NavigationTreeSlot = "header" | "content" | "footer";

export interface NavigationTreeOwner {
  kind: "mode" | "page";
  id: string;
  extensionId: string;
}

export interface NavigationTreeContext {
  resource?: ResourceRef;
}

export interface NavigationTreeContribution {
  id: string;
  /** Prefix projected section and node ids when they come from an independent tree renderer. */
  idScope?: string;
  owner: NavigationTreeOwner;
  sourceExtensionId: string;
  declarationIndex: number;
  slot?: NavigationTreeSlot;
  defaultExpandedSectionIds?: string[];
  getSections(context: NavigationTreeContext): Promise<TreeViewSection[]> | TreeViewSection[];
  getChildren?(node: TreeNode, context: NavigationTreeContext): Promise<TreeNode[]> | TreeNode[];
}

export interface NavigationTreeRegistry {
  registerContribution(contribution: NavigationTreeContribution): Disposable;
  resolveOwner(kind: NavigationTreeOwner["kind"], id: string): NavigationTreeOwner | undefined;
  getSections(
    owner: NavigationTreeOwner,
    slot?: NavigationTreeSlot,
    context?: NavigationTreeContext,
  ): Promise<TreeViewSection[]>;
  getChildren(node: TreeNode, context?: NavigationTreeContext): Promise<TreeNode[]>;
  getDefaultExpandedSectionIds(owner: NavigationTreeOwner): string[];
  onDidChange(listener: () => void): Disposable;
}

const ownerId = (owner: NavigationTreeOwner) => `${owner.kind}:${owner.extensionId}:${owner.id}`;

const ownersEqual = (left: NavigationTreeOwner, right: NavigationTreeOwner) => ownerId(left) === ownerId(right);

const contributionOrder =
  (owner: NavigationTreeOwner) => (left: NavigationTreeContribution, right: NavigationTreeContribution) => {
    const leftOwn = left.sourceExtensionId === owner.extensionId;
    const rightOwn = right.sourceExtensionId === owner.extensionId;
    if (leftOwn !== rightOwn) return leftOwn ? -1 : 1;
    if (!leftOwn) {
      const extensionOrder = left.sourceExtensionId.localeCompare(right.sourceExtensionId);
      if (extensionOrder !== 0) return extensionOrder;
    }
    return left.declarationIndex - right.declarationIndex || left.id.localeCompare(right.id);
  };

const scopedId = (scope: string | undefined, id: string) => (scope ? `${scope}:${id}` : id);

const mergeSection = (sections: TreeViewSection[], section: TreeViewSection) => {
  const index = sections.findIndex((candidate) => candidate.id === section.id);
  if (index < 0) {
    sections.push(section);
    return;
  }
  const current = sections[index]!;
  sections[index] = { ...current, nodes: [...current.nodes, ...section.nodes] };
};

export const createNavigationTreeRegistry = (): NavigationTreeRegistry => {
  const contributions = new Map<string, NavigationTreeContribution>();
  const nodeSources = new WeakMap<TreeNode, { contribution: NavigationTreeContribution; node: TreeNode }>();
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };

  const matching = (owner: NavigationTreeOwner, slot: NavigationTreeSlot) =>
    [...contributions.values()]
      .filter((contribution) => ownersEqual(contribution.owner, owner) && (contribution.slot ?? "content") === slot)
      .sort(contributionOrder(owner));

  const projectNode = (node: TreeNode, contribution: NavigationTreeContribution, moveScope: string): TreeNode => {
    const projected: TreeNode = {
      ...node,
      id: scopedId(contribution.idScope, node.id),
      moveScope,
      canHide: node.canHide ?? true,
      canReorder: node.canReorder ?? true,
      children: node.children?.map((child) => projectNode(child, contribution, moveScope)),
    };
    nodeSources.set(projected, { contribution, node });
    return projected;
  };

  const projectSection = (
    section: TreeViewSection,
    contribution: NavigationTreeContribution,
    moveScope: string,
  ): TreeViewSection => ({
    ...section,
    id: scopedId(contribution.idScope, section.id),
    moveScope,
    canHide: section.canHide ?? true,
    canReorder: section.canReorder ?? true,
    nodes: section.nodes.map((node) => projectNode(node, contribution, moveScope)),
  });

  return {
    registerContribution(contribution) {
      if (contributions.has(contribution.id)) {
        throw new Error(`Navigation tree contribution already registered: ${contribution.id}`);
      }
      contributions.set(contribution.id, contribution);
      emit();
      return createDisposable(() => {
        if (contributions.get(contribution.id) !== contribution) return;
        contributions.delete(contribution.id);
        emit();
      });
    },

    resolveOwner(kind, id) {
      return [...contributions.values()].find(
        (contribution) => contribution.owner.kind === kind && contribution.owner.id === id,
      )?.owner;
    },

    async getSections(owner, slot = "content", context = {}) {
      const sections: TreeViewSection[] = [];
      const moveScope = ownerId(owner);
      for (const contribution of matching(owner, slot)) {
        for (const section of await contribution.getSections(context)) {
          mergeSection(sections, projectSection(section, contribution, moveScope));
        }
      }
      return sections;
    },

    async getChildren(node, context = {}) {
      const source = nodeSources.get(node);
      if (!source?.contribution.getChildren) return node.children ?? [];
      const moveScope = node.moveScope ?? ownerId(source.contribution.owner);
      const children = await source.contribution.getChildren(source.node, context);
      return children.map((child) => projectNode(child, source.contribution, moveScope));
    },

    getDefaultExpandedSectionIds(owner) {
      return (["header", "content", "footer"] as const).flatMap((slot) =>
        matching(owner, slot).flatMap((contribution) =>
          (contribution.defaultExpandedSectionIds ?? []).map((id) => scopedId(contribution.idScope, id)),
        ),
      );
    },

    onDidChange(listener) {
      listeners.add(listener);
      return createDisposable(() => listeners.delete(listener));
    },
  };
};
