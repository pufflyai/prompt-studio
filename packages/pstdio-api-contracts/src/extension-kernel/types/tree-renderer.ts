import type { Localizable } from "../l10n";
import type { CommandRef } from "./commands";
import type { RendererCallback } from "./context";
import type { JsonObject, JsonValue, Struct } from "./json";
import type { ExtensionNavigationTarget } from "./navigation-target";
import type { ParamObjectSchema } from "./params";
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

export interface TreeRendererActionParams extends TreeRendererQueryParams {
  actionId: string;
  node?: TreeNode;
}

export type TreeNodeTarget = ExtensionNavigationTarget;

export interface TreeAction {
  id: string;
  label?: Localizable<string>;
  icon?: string;
  command?: CommandRef<Struct, unknown> | string;
  params?: Struct;
  input?: ParamObjectSchema;
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

export type TreeNodeRowVariant = "empty-state";

export interface TreeNode {
  id: string;
  label: Localizable<string>;
  icon?: string;
  iconColor?: string;
  iconTooltip?: string;
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
  description?: string;
  contextValue?: string;
  hiddenByDefault?: boolean;
  /** Opt in to the tree's hide/show customization menu (header/footer rows). Off by default. */
  canHide?: boolean;
  metadata?: JsonObject;
}

export interface TreeViewSection {
  id: string;
  label?: Localizable<string>;
  actions?: TreeAction[];
  collapsible?: boolean;
  emptyState?: TreeSectionEmptyState;
  nodes: TreeNode[];
  hiddenByDefault?: boolean;
  /** Opt in to the tree's hide/show customization menu (a category). Off by default. */
  canHide?: boolean;
}

export interface TreeRendererContribution {
  title: Localizable<string>;
  icon?: string;
  body: RendererCallback<TreeRendererQueryParams, TreeViewSection[]>;
  children?: RendererCallback<TreeRendererChildrenParams, TreeNode[]>;
  footer?: RendererCallback<TreeRendererQueryParams, TreeNode[]>;
  defaultExpandedSectionIds?: string[];
  defaultExpandedNodeIds?: string[];
}

export type TreeRendererCommandResult = TreeViewSection[] | TreeNode[] | JsonValue;
