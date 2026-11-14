import type { QueryChangeEnvelope } from "@pstdio/sdk/extensions";
import type { ContributionMetadata, RegisteredContributionMetadata } from "../../shared/contributions/metadata";
import type { Disposable } from "../../shared/disposable";
import type { WorkbenchStore } from "../../shared/store/workbench-store";
import type { CommandParamSchema, WorkbenchCommandExecutionContext } from "../commands/command-registry";
import type { MenuPath } from "../menus/menu-registry";
import type { NavigationTarget } from "../navigation/navigation-registry";
import type { ResourceRef } from "../resources/resource-registry";
import type { WorkbenchPanelRenderInput, WorkbenchRendererRegistry } from "./renderer-registry";

export interface TreeQueryContext {
  pageParams?: import("@pstdio/sdk/extensions").PageParams;
  signal?: AbortSignal;
  /** Publish available sections while the rest of the current read is still loading. */
  onProgress?(sections: TreeViewSection[]): void;
  filter?: string;
  resource?: ResourceRef;
  /** Widget/view contribution id for trees rendered through a view-backed widget. */
  viewId?: string;
}

export interface TreeContext extends TreeQueryContext {
  state: Readonly<TreeRendererState>;
  refresh(): void;
  setSelectedNode(nodeId: string | undefined): void;
}

export interface TreeMoveContext extends TreeContext {
  position?: "before" | "after" | "inside";
}

export interface TreeAction {
  resourceMutation?: import("@pstdio/sdk/extensions").CommandDefinition["resourceMutation"];
  id: string;
  label?: string;
  icon?: string;
  commandId?: string;
  args?: unknown;
  params?: CommandParamSchema;
  inlineInput?: { field: string; placement: "replace" | "child"; nodeId?: string };
  copyText?: string;
  /** Execute during menu selection while clipboard user activation is available. */
  copyResultToClipboard?: boolean;
  // Confirm-button label for the action's params dialog (defaults to "Run").
  submitLabel?: string;
  when?: string;
  disabled?: boolean;
  run?(args?: unknown, context?: WorkbenchCommandExecutionContext): Promise<void> | void;
}

export type TreeNodeRowVariant = "empty-state" | "file";

export interface TreeNodePage {
  nodes: TreeNode[];
  nextPage?: TreePageLoader;
}

export type TreePageLoader = (signal: AbortSignal) => Promise<TreeNodePage>;

export interface TreePageStatus {
  loading?: boolean;
  error?: string;
  loadMore(): Promise<void> | void;
}

export interface TreeNodeInlineInput {
  ariaLabel: string;
  defaultValue?: string;
  placeholder?: string;
  onCommit(value: string): Promise<void> | void;
  onCancel?(): void;
}

export interface TreeNode {
  id: string;
  selected?: boolean;
  /** Host-owned customization boundary. Extension callbacks cannot set it. */
  moveScope?: string;
  label: string;
  icon?: string;
  iconElement?: unknown;
  fileName?: string;
  iconColor?: string;
  /** Subdued foreground without disabling row actions or navigation. */
  tone?: "default" | "muted";
  badge?: { label: string; color?: string };
  iconTooltip?: string;
  tooltip?: string;
  endContent?: unknown;
  commandId?: string;
  resource?: ResourceRef;
  target?: NavigationTarget;
  /** Visual row variant for non-data rows such as placeholders. */
  rowVariant?: TreeNodeRowVariant;
  inlineInput?: TreeNodeInlineInput;
  actions?: TreeAction[];
  contextMenuActions?: TreeAction[];
  contextMenuPath?: MenuPath;
  menuPath?: MenuPath;
  menuPlacement?: "top-start" | "top-end" | "bottom-start" | "bottom-end" | "right-start" | "left-start";
  showContextMenuTrigger?: boolean;
  collapsible?: boolean;
  disabled?: boolean;
  children?: TreeNode[];
  /** Read the next bounded page of children. */
  nextPage?: TreePageLoader;
  /** Owned by the current tree read; passed to the shared list. */
  pagination?: TreePageStatus;
  description?: string;
  contextValue?: string;
  hiddenByDefault?: boolean;
  /** When true, the node (e.g. a header/footer row) opts in to the tree's hide/show customization menu. */
  canHide?: boolean;
  /** When false, the node stays fixed within its Sidenav group. */
  canReorder?: boolean;
  /** Show the row only where users pinned it in the header or footer, never in the body. */
  pinnedOnly?: boolean;
  /** Allow this node to be moved to another tree location. */
  canDrag?: boolean;
  /** Allow movable nodes to be dropped on this node. */
  canDrop?: boolean;
}

export interface TreeSectionEmptyState {
  title: string;
  description?: string;
  icon?: string;
}

export interface TreeViewSection {
  id: string;
  /** This section's structure is known, but its contents have not arrived yet. */
  loading?: boolean;
  /** Host-owned customization boundary. Extension callbacks cannot set it. */
  moveScope?: string;
  label?: string;
  /** Names a section without a visible header in the customize menu. */
  menuLabel?: string;
  actions?: TreeAction[];
  collapsible?: boolean;
  emptyState?: TreeSectionEmptyState;
  nodes: TreeNode[];
  nextPage?: TreePageLoader;
  pagination?: TreePageStatus;
  hiddenByDefault?: boolean;
  /** When true, the section (category) opts in to the tree's hide/show customization menu. */
  canHide?: boolean;
  /** When false, the section stays fixed within the Sidenav main region. */
  canReorder?: boolean;
}

export interface TreeMoveEndpoint {
  kind: "section" | "node";
  sectionId: string;
  id: string;
  moveScope?: string;
}

export type TreeMovePolicy = (move: { source: TreeMoveEndpoint; destination: TreeMoveEndpoint }) => boolean;

export interface TreeRendererContribution {
  /** Captured host identity; never infer a hidden view's project from current selection. */
  queryEvents?: readonly string[];
  queryScope?: Partial<import("@pstdio/sdk/extensions").QueryScope>;
  id: string;
  title: string;
  icon?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  when?: string;
  defaultExpandedSectionIds?: string[];
  defaultExpandedNodeIds?: string[];
  /** Identify the navigation data scope when it differs from the current page resource. */
  getReadKey?(ctx: TreeQueryContext): string;
  /** Observe change hints only while this tree query has a mounted presentation. */
  subscribe?(ctx: TreeQueryContext, invalidate: () => void): () => void;
  /** Synchronous layout available before the first content read. */
  getStructure?(ctx: TreeQueryContext): TreeViewSection[];
  getHeaderStructure?(ctx: TreeQueryContext): TreeViewSection[];
  getFooterStructure?(ctx: TreeQueryContext): TreeViewSection[];
  getBody(ctx: TreeContext): Promise<TreeViewSection[]> | TreeViewSection[];
  getHeader?(ctx: TreeContext): Promise<TreeViewSection[]> | TreeViewSection[];
  getFooter?(ctx: TreeContext): Promise<TreeViewSection[]> | TreeViewSection[];
  getChildren(node: TreeNode, ctx: TreeContext): Promise<TreeNode[]> | TreeNode[];
  canMove?: TreeMovePolicy;
  moveNode?(source: TreeNode, target: TreeNode | undefined, ctx: TreeMoveContext): Promise<void> | void;
}

export interface RegisteredTreeRendererContribution extends TreeRendererContribution, RegisteredContributionMetadata {}

export interface TreeRendererState {
  expandedNodeIds: string[];
  expandedSectionIds: string[];
  selectedNodeId?: string;
  loading?: boolean;
}

export interface TreeRendererRefreshEvent extends QueryChangeEnvelope {
  treeId: string;
}

export interface TreeRendererStoreState {
  trees: Record<string, RegisteredTreeRendererContribution>;
  statesByTreeId: Record<string, TreeRendererState>;
  refreshKeysByTreeId: Record<string, number>;
}

export interface PersistedTreeRendererStates {
  statesByTreeId: Record<string, TreeRendererState>;
}

export interface TreeRendererPersistenceAdapter {
  getTreeStates(): PersistedTreeRendererStates | undefined;
  setTreeStates(states: PersistedTreeRendererStates): void;
}

// The React layer supplies the actual rendering for a tree id when a widget
// references it. Set once on workbench mount via setTreeRendererImplementation
// so registerTreeRenderer can auto-register a renderer entry with the same id.
export type TreeRendererImplementation = (input: WorkbenchPanelRenderInput & { treeId: string }) => unknown;

export interface CreateTreeRendererRegistryInput {
  rendererRegistry: WorkbenchRendererRegistry;
  persistence?: TreeRendererPersistenceAdapter;
}

export type TreeRendererRefreshListener = (event: TreeRendererRefreshEvent) => void;

export interface TreeRendererRegistry {
  treeStore: WorkbenchStore<TreeRendererStoreState>;
  registerTreeRenderer(view: TreeRendererContribution, metadata?: ContributionMetadata): Disposable;
  setTreeRendererImplementation(impl: TreeRendererImplementation): void;
  getTreeRenderer(id: string): RegisteredTreeRendererContribution | undefined;
  listTreeRenderers(): RegisteredTreeRendererContribution[];
  getBody(id: string, ctx?: TreeQueryContext): Promise<TreeViewSection[]>;
  getHeader(id: string, ctx?: TreeQueryContext): Promise<TreeViewSection[]>;
  getFooter(id: string, ctx?: TreeQueryContext): Promise<TreeViewSection[]>;
  getChildren(id: string, node: TreeNode, ctx?: TreeQueryContext): Promise<TreeNode[]>;
  getTreeState(id: string): TreeRendererState;
  setNodeExpanded(id: string, nodeId: string, expanded: boolean): void;
  setSectionExpanded(id: string, sectionId: string, expanded: boolean): void;
  setSelectedNode(id: string, nodeId: string | undefined): void;
  setLoading(id: string, loading: boolean): void;
  refresh(id: string, event?: QueryChangeEnvelope): void;
  onDidRefresh(listener: TreeRendererRefreshListener): Disposable;
}
