import type { ContributionMetadata, RegisteredContributionMetadata } from "../../shared/contributions/metadata";
import type { Disposable } from "../../shared/disposable";
import type { WorkbenchStore } from "../../shared/store/workbench-store";
import type { CommandParamSchema } from "../commands/command-registry";
import type { MenuPath } from "../menus/menu-registry";
import type { NavigationTarget } from "../navigation/navigation-registry";
import type { ResourceRef } from "../resources/resource-registry";
import type { WorkbenchPanelRenderInput, WorkbenchRendererRegistry } from "./renderer-registry";

export interface TreeQueryContext {
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

export interface TreeAction {
  id: string;
  label?: string;
  icon?: string;
  commandId?: string;
  args?: unknown;
  params?: CommandParamSchema;
  // Confirm-button label for the action's params dialog (defaults to "Run").
  submitLabel?: string;
  when?: string;
  disabled?: boolean;
  run?(args?: unknown): Promise<void> | void;
}

export type TreeNodeRowVariant = "empty-state";

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
  iconColor?: string;
  iconTooltip?: string;
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
  description?: string;
  contextValue?: string;
  hiddenByDefault?: boolean;
  /** When true, the node (e.g. a header/footer row) opts in to the tree's hide/show customization menu. */
  canHide?: boolean;
  /** When false, the node stays fixed within its Sidenav group. */
  canReorder?: boolean;
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
  /** Host-owned customization boundary. Extension callbacks cannot set it. */
  moveScope?: string;
  label?: string;
  actions?: TreeAction[];
  collapsible?: boolean;
  emptyState?: TreeSectionEmptyState;
  nodes: TreeNode[];
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
  id: string;
  title: string;
  icon?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  when?: string;
  defaultExpandedSectionIds?: string[];
  defaultExpandedNodeIds?: string[];
  getBody(ctx: TreeContext): Promise<TreeViewSection[]> | TreeViewSection[];
  getHeader?(ctx: TreeContext): Promise<TreeViewSection[]> | TreeViewSection[];
  getFooter?(ctx: TreeContext): Promise<TreeViewSection[]> | TreeViewSection[];
  getChildren(node: TreeNode, ctx: TreeContext): Promise<TreeNode[]> | TreeNode[];
  canMove?: TreeMovePolicy;
  moveNode?(source: TreeNode, target: TreeNode | undefined, ctx: TreeContext): Promise<void> | void;
}

export interface RegisteredTreeRendererContribution extends TreeRendererContribution, RegisteredContributionMetadata {}

export interface TreeRendererState {
  expandedNodeIds: string[];
  expandedSectionIds: string[];
  selectedNodeId?: string;
  loading?: boolean;
}

export interface TreeRendererRefreshEvent {
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
  refresh(id: string): void;
  onDidRefresh(listener: TreeRendererRefreshListener): Disposable;
}
