import type { QueryChangeEnvelope, ScopedQueryClient } from "@pstdio/sdk/extensions";
import type { Disposable } from "../../shared/disposable";
import type { TreeNode, TreeViewSection } from "../renderers/tree-renderer-types";
import type { ResourceRef } from "../resources/resource-registry";
import type { NavigationTarget } from "./navigation-registry";

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
  projectId?: string;
  resource?: ResourceRef;
  signal?: AbortSignal;
  onProgress?(sections: TreeViewSection[]): void;
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
  getStructure?(context: NavigationTreeContext): TreeViewSection[];
  getSections?(context: NavigationTreeContext): Promise<TreeViewSection[]> | TreeViewSection[];
  getChildren?(node: TreeNode, context: NavigationTreeContext): Promise<TreeNode[]> | TreeNode[];
  /** Authored actions for discovery, independent of tree data and visibility context. */
  listActions?(): DeclaredNavigationAction[];
}

export interface CreateNavigationTreeRegistryInput {
  queries?: ScopedQueryClient;
  subscribeViewRefresh?(viewId: string, listener: (event?: QueryChangeEnvelope) => void): Disposable;
  getViewDefaultExpandedSectionIds?(viewId: string): readonly string[] | undefined;
  getViewDefaultExpandedNodeIds?(viewId: string): readonly string[] | undefined;
  getViewSections?(viewId: string, context: NavigationTreeContext): Promise<TreeViewSection[]> | TreeViewSection[];
  getViewStructure?(viewId: string, context: NavigationTreeContext): TreeViewSection[];
  getViewChildren?(viewId: string, node: TreeNode, context: NavigationTreeContext): Promise<TreeNode[]> | TreeNode[];
  moveViewNode?(
    viewId: string,
    source: TreeNode,
    target: TreeNode | undefined,
    context: NavigationTreeMoveContext,
  ): Promise<void> | void;
}

export interface NavigationTreeRegistry {
  dispose?(): void;
  listActions(): (DeclaredNavigationAction & { ownerId: string })[];
  registerContribution(contribution: NavigationTreeContribution): Disposable;
  resolveOwner(
    kind: NavigationTreeOwner["kind"],
    id: string,
    slot?: NavigationTreeSlot,
  ): NavigationTreeOwner | undefined;
  getReadKey(owner: NavigationTreeOwner, context?: NavigationTreeContext): string;
  getStructure(
    owner: NavigationTreeOwner,
    slot?: NavigationTreeSlot,
    context?: NavigationTreeContext,
  ): TreeViewSection[];
  getSections(
    owner: NavigationTreeOwner,
    slot?: NavigationTreeSlot,
    context?: NavigationTreeContext,
  ): Promise<TreeViewSection[]>;
  getChildren(node: TreeNode, context?: NavigationTreeContext): Promise<TreeNode[]>;
  moveNode(source: TreeNode, target: TreeNode | undefined, context?: NavigationTreeMoveContext): Promise<void>;
  getDefaultExpandedSectionIds(owner: NavigationTreeOwner, slot?: NavigationTreeSlot): string[];
  getDefaultExpandedNodeIds(owner: NavigationTreeOwner, slot?: NavigationTreeSlot): string[];
  /** Counts contributions registered and removed, unlike `onDidChange`, which also fires on refreshes. */
  getRegistrationRevision(): number;
  onDidChange(listener: () => void): Disposable;
}
