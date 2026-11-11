import type { Localizable } from "../l10n";
import type { CommandRef } from "./commands";
import type { RendererCallback } from "./context";
import type { JsonObject, JsonValue, Struct } from "./json";
import type { NavigationTarget } from "./navigation-target";
import type { ParamObjectSchema } from "./params";
import type { RendererContributionBase } from "./renderer-base";
import type { RendererContext, ResourceRef } from "./resources";

export type TreeRendererResourceRef = ResourceRef;

export interface TreeRendererState {
  expandedNodeIds: string[];
  expandedSectionIds: string[];
  selectedNodeId?: string;
}

export interface TreeRendererQueryParams {
  renderer: RendererContext;
  state?: TreeRendererState;
  filter?: string;
}

export interface TreeRendererChildrenParams extends TreeRendererQueryParams {
  node: TreeNode;
}

/** Continue a section's nodes or an expanded node's children in the same query scope. */
export interface TreeRendererPageParams extends TreeRendererQueryParams {
  cursor: string;
  parent: { kind: "section"; id: string } | { kind: "node"; node: TreeNode };
}

export interface TreeNodePage {
  nodes: TreeNode[];
  /** Omit when the collection is exhausted. */
  nextCursor?: string;
}

export interface TreeRendererActionParams extends TreeRendererQueryParams {
  actionId: string;
  node?: TreeNode;
}

export interface TreeRendererMoveParams extends TreeRendererQueryParams {
  source: TreeNode;
  /** Omitted for a drop on the tree background. */
  target?: TreeNode;
  /** Containers accept inside drops; leaf rows use their upper/lower half for before/after. */
  position: "before" | "after" | "inside";
}

export type TreeNodeTarget = NavigationTarget;

export interface TreeAction {
  id: string;
  label?: Localizable<string>;
  icon?: string;
  command?: CommandRef<Struct, unknown>;
  params?: Struct;
  input?: ParamObjectSchema;
  /** A single text parameter edited in the tree, without a modal. */
  inputPresentation?: { kind: "inline"; field: string; placement: "replace" | "child" };
  /** Copied by the host during the user gesture. */
  copyText?: string;
  // Confirm-button label for the action's params dialog (defaults to "Run").
  submitLabel?: string;
  when?: string;
  disabled?: boolean;
}

export interface TreeSectionEmptyState {
  title: Localizable<string>;
  description?: Localizable<string>;
  icon?: string;
}

export type TreeNodeRowVariant = "empty-state" | "file";

export interface TreeNode {
  id: string;
  label: Localizable<string>;
  icon?: string;
  iconColor?: string;
  /** File icon theme hint for native file rows. */
  fileName?: string;
  showContextMenuTrigger?: boolean;
  /** Trailing count, using the same badge as notification counts. */
  badge?: { label: string; color?: string };
  /** Small activity or status marker beside the row. */
  indicator?: { icon: string; color?: string; label?: Localizable<string> };
  iconTooltip?: string;
  /** Shown while the pointer rests on the row or the row has keyboard focus. `iconTooltip` covers only the icon. */
  tooltip?: string;
  resource?: TreeRendererResourceRef;
  target?: TreeNodeTarget;
  /** Visual row variant for non-data rows such as placeholders. */
  rowVariant?: TreeNodeRowVariant;
  actions?: TreeAction[];
  contextMenuActions?: TreeAction[];
  collapsible?: boolean;
  disabled?: boolean;
  // Marks this node as the selected one so the host highlights it (e.g. the open
  // document in a files tree). The renderer reflects it into the tree selection.
  selected?: boolean;
  children?: TreeNode[];
  /** Cursor for more children, appended automatically while this node is expanded. Requires `page`. */
  nextCursor?: string;
  description?: string;
  contextValue?: string;
  hiddenByDefault?: boolean;
  /** Opt in to the tree's hide/show customization menu (header/footer rows). Off by default. */
  canHide?: boolean;
  /** Opt in to native dragging and owner-handled drops. */
  canDrag?: boolean;
  canDrop?: boolean;
  metadata?: JsonObject;
}

export interface TreeViewSection {
  id: string;
  label?: Localizable<string>;
  actions?: TreeAction[];
  collapsible?: boolean;
  emptyState?: TreeSectionEmptyState;
  nodes: TreeNode[];
  /** Cursor for more nodes, appended automatically when this section's end enters view. Requires `page`. */
  nextCursor?: string;
  hiddenByDefault?: boolean;
  /** Opt in to the tree's hide/show customization menu (a category). Off by default. */
  canHide?: boolean;
}

/** Layout the host can render before fetching the section's contents. */
export interface TreeViewSectionStructure {
  id: string;
  label?: Localizable<string>;
  collapsible?: boolean;
  hiddenByDefault?: boolean;
  canHide?: boolean;
  /** Display the current resource using its already-known label. */
  resourceNode?: { id: string; icon?: string };
}

export interface TreeRendererContribution extends RendererContributionBase {
  /** Section layout sent with view metadata; no renderer callback is needed to display it. */
  structure?: TreeViewSectionStructure[];
  searchable?: boolean;
  searchPlaceholder?: Localizable<string>;
  header?: RendererCallback<TreeRendererQueryParams, TreeViewSection[]>;
  body: RendererCallback<TreeRendererQueryParams, TreeViewSection[]>;
  children?: RendererCallback<TreeRendererChildrenParams, TreeNode[]>;
  page?: RendererCallback<TreeRendererPageParams, TreeNodePage>;
  footer?: RendererCallback<TreeRendererQueryParams, TreeViewSection[]>;
  /** Persist a drop between nodes owned by this tree. */
  onMove?: RendererCallback<TreeRendererMoveParams, void>;
  defaultExpandedSectionIds?: string[];
  defaultExpandedNodeIds?: string[];
}

export type TreeRendererCommandResult = TreeViewSection[] | TreeNode[] | JsonValue;
