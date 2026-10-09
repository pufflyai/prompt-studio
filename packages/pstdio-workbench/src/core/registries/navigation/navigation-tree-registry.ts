import { resourceKey } from "@pstdio/sdk/extensions";
import { createDisposable, type Disposable } from "../../shared/disposable";
import type { TreeNode, TreeViewSection } from "../renderers/tree-renderer-registry";
import type { ResourceRef } from "../resources/resource-registry";
import type { NavigationTarget } from "./navigation-registry";
import { getNavigationTreeNodeSource, setNavigationTreeNodeSource } from "./navigation-tree-node-source";

export interface DeclaredNavigationAction {
  label: string;
  action: NavigationTarget;
  category?: string;
}

export type NavigationTreeSlot = "header" | "content" | "footer";

export interface NavigationTreeOwner {
  kind: "mode" | "page";
  id: string;
  extensionId: string;
}

export interface NavigationTreeContext {
  resource?: ResourceRef;
  signal?: AbortSignal;
}

export interface NavigationTreeMoveContext extends NavigationTreeContext {
  position?: "before" | "after" | "inside";
}

export interface NavigationTreeContribution {
  id: string;
  /** Prefix projected section and node ids when they come from an independent tree renderer. */
  idScope?: string;
  owner: NavigationTreeOwner;
  sourceExtensionId: string;
  declarationIndex: number;
  slot?: NavigationTreeSlot;
  viewId?: string;
  defaultExpandedSectionIds?: string[];
  /** Resolve the data resource independently of the selected navigation item. */
  resolveResource?(resource: ResourceRef | undefined): ResourceRef | undefined;
  getSections?(context: NavigationTreeContext): Promise<TreeViewSection[]> | TreeViewSection[];
  getChildren?(node: TreeNode, context: NavigationTreeContext): Promise<TreeNode[]> | TreeNode[];
  /** Authored actions for discovery, independent of tree data and visibility context. */
  listActions?(): DeclaredNavigationAction[];
}

export interface CreateNavigationTreeRegistryInput {
  subscribeViewRefresh?(viewId: string, listener: () => void): Disposable;
  getViewDefaultExpandedSectionIds?(viewId: string): readonly string[] | undefined;
  getViewSections?(viewId: string, context: NavigationTreeContext): Promise<TreeViewSection[]> | TreeViewSection[];
  getViewChildren?(viewId: string, node: TreeNode, context: NavigationTreeContext): Promise<TreeNode[]> | TreeNode[];
  moveViewNode?(
    viewId: string,
    source: TreeNode,
    target: TreeNode | undefined,
    context: NavigationTreeMoveContext,
  ): Promise<void> | void;
}

export interface NavigationTreeRegistry {
  listActions(): (DeclaredNavigationAction & { ownerId: string })[];
  registerContribution(contribution: NavigationTreeContribution): Disposable;
  resolveOwner(
    kind: NavigationTreeOwner["kind"],
    id: string,
    slot?: NavigationTreeSlot,
  ): NavigationTreeOwner | undefined;
  getReadKey(owner: NavigationTreeOwner, context?: NavigationTreeContext): string;
  getSections(
    owner: NavigationTreeOwner,
    slot?: NavigationTreeSlot,
    context?: NavigationTreeContext,
  ): Promise<TreeViewSection[]>;
  getChildren(node: TreeNode, context?: NavigationTreeContext): Promise<TreeNode[]>;
  moveNode(source: TreeNode, target: TreeNode | undefined, context?: NavigationTreeMoveContext): Promise<void>;
  getDefaultExpandedSectionIds(owner: NavigationTreeOwner, slot?: NavigationTreeSlot): string[];
  onDidChange(listener: () => void): Disposable;
}

// The owner's top-level section. Extensions add ungrouped entries here and use a labeled section for a named group.
export const navigationRootSectionId = "navigation.root";
// Each slot keeps its own root, so pinned header and footer rows never share a section id with the body.
export const navigationSlotRootSectionId = (slot: NavigationTreeSlot = "content") =>
  slot === "content" ? navigationRootSectionId : `navigation.${slot}`;

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

const readContext = (contribution: NavigationTreeContribution, context: NavigationTreeContext) => ({
  ...context,
  resource: contribution.resolveResource ? contribution.resolveResource(context.resource) : context.resource,
});

const mergeSection = (sections: TreeViewSection[], section: TreeViewSection) => {
  const index = sections.findIndex((candidate) => candidate.id === section.id);
  if (index < 0) {
    sections.push(section);
    return;
  }
  const current = sections[index]!;
  sections[index] = { ...current, nodes: [...current.nodes, ...section.nodes] };
};

export const createNavigationTreeRegistry = (input: CreateNavigationTreeRegistryInput = {}): NavigationTreeRegistry => {
  const contributions = new Map<string, NavigationTreeContribution>();
  const registryToken = {};
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };

  const matching = (owner: NavigationTreeOwner, slot: NavigationTreeSlot) =>
    [...contributions.values()]
      .filter((contribution) => ownersEqual(contribution.owner, owner) && (contribution.slot ?? "content") === slot)
      .sort(contributionOrder(owner));

  const projectNode = (
    node: TreeNode,
    contribution: NavigationTreeContribution,
    moveScope: string,
    resource?: ResourceRef,
  ): TreeNode => {
    const projected: TreeNode = {
      ...node,
      id: scopedId(contribution.idScope, node.id),
      moveScope,
      // Mode rows are navigation links users may hide and arrange; page-owned level rows are data such as notes
      // or sessions, which keep the order their owner gives them unless a row opts in.
      canHide: node.canHide ?? contribution.owner.kind === "mode",
      canReorder: node.canReorder ?? contribution.owner.kind === "mode",
      children: node.children?.map((child) => projectNode(child, contribution, moveScope, resource)),
    };
    setNavigationTreeNodeSource(projected, { contribution, node, resource, registryToken });
    return projected;
  };

  const projectSection = (
    section: TreeViewSection,
    contribution: NavigationTreeContribution,
    owner: NavigationTreeOwner,
    resource?: ResourceRef,
  ): TreeViewSection => ({
    ...section,
    id:
      contribution.sourceExtensionId !== owner.extensionId && !section.label
        ? navigationSlotRootSectionId(contribution.slot)
        : scopedId(contribution.idScope, section.id),
    moveScope: ownerId(owner),
    canHide: section.canHide ?? true,
    canReorder: section.canReorder ?? true,
    nodes: section.nodes.map((node) => projectNode(node, contribution, ownerId(owner), resource)),
  });

  return {
    registerContribution(contribution) {
      if (contributions.has(contribution.id)) {
        throw new Error(`Navigation tree contribution already registered: ${contribution.id}`);
      }
      if (!contribution.viewId && !contribution.getSections) {
        throw new Error(`Navigation tree contribution must declare a viewId or getSections: ${contribution.id}`);
      }
      contributions.set(contribution.id, contribution);
      const refreshSubscription = contribution.viewId
        ? input.subscribeViewRefresh?.(contribution.viewId, emit)
        : undefined;
      emit();
      return createDisposable(() => {
        if (contributions.get(contribution.id) !== contribution) return;
        refreshSubscription?.dispose();
        contributions.delete(contribution.id);
        emit();
      });
    },

    resolveOwner(kind, id, slot) {
      return [...contributions.values()].find(
        (contribution) =>
          contribution.owner.kind === kind &&
          contribution.owner.id === id &&
          (!slot || (contribution.slot ?? "content") === slot),
      )?.owner;
    },

    getReadKey(owner, context = {}) {
      return JSON.stringify(
        (["header", "content", "footer"] as const).flatMap((slot) =>
          matching(owner, slot).map((contribution) => [
            contribution.id,
            resourceKey(readContext(contribution, context).resource),
          ]),
        ),
      );
    },

    async getSections(owner, slot = "content", context = {}) {
      const sections: TreeViewSection[] = [];
      for (const contribution of matching(owner, slot)) {
        context.signal?.throwIfAborted();
        const query = readContext(contribution, context);
        const sourceSections = contribution.viewId
          ? await input.getViewSections?.(contribution.viewId, query)
          : await contribution.getSections?.(query);
        context.signal?.throwIfAborted();
        for (const section of sourceSections ?? []) {
          mergeSection(sections, projectSection(section, contribution, owner, query.resource));
        }
      }
      return sections;
    },

    async getChildren(node, context = {}) {
      context.signal?.throwIfAborted();
      const source = getNavigationTreeNodeSource(node, registryToken);
      if (!source) return node.children ?? [];
      const moveScope = node.moveScope ?? ownerId(source.contribution.owner);
      const query = { ...context, resource: source.resource };
      const children = source.contribution.viewId
        ? await input.getViewChildren?.(source.contribution.viewId, source.node, query)
        : await source.contribution.getChildren?.(source.node, query);
      if (!children) return node.children ?? [];
      return children.map((child) => projectNode(child, source.contribution, moveScope, source.resource));
    },

    async moveNode(sourceNode, targetNode, context = {}) {
      const source = getNavigationTreeNodeSource(sourceNode, registryToken);
      const target = targetNode ? getNavigationTreeNodeSource(targetNode, registryToken) : undefined;
      if (!source?.contribution.viewId || !source.node.canDrag) return;
      if (targetNode && (!target || source.contribution !== target.contribution || !target.node.canDrop)) return;
      await input.moveViewNode?.(source.contribution.viewId, source.node, target?.node, {
        ...context,
        resource: source.resource,
      });
    },

    getDefaultExpandedSectionIds(owner, selectedSlot) {
      const slots: readonly NavigationTreeSlot[] = selectedSlot ? [selectedSlot] : ["header", "content", "footer"];
      return slots.flatMap((slot) =>
        matching(owner, slot).flatMap((contribution) =>
          (
            contribution.defaultExpandedSectionIds ??
            (contribution.viewId ? input.getViewDefaultExpandedSectionIds?.(contribution.viewId) : undefined) ??
            []
          ).map((id) => scopedId(contribution.idScope, id)),
        ),
      );
    },

    onDidChange(listener) {
      listeners.add(listener);
      return createDisposable(() => listeners.delete(listener));
    },
    listActions() {
      return [...contributions.values()].flatMap((contribution) =>
        (contribution.listActions?.() ?? []).map((action) => ({
          ...action,
          ownerId: contribution.sourceExtensionId,
        })),
      );
    },
  };
};
