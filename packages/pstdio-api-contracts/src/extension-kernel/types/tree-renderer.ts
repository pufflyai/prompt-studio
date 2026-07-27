import type { Localizable } from "../l10n";
import type { CommandRef } from "./commands";
import type { JsonObject, JsonValue } from "./json";
import type { ParamObjectSchema } from "./params";

export interface TreeRendererResourceRef {
  type: string;
  id: string;
  projectId?: string;
  label?: string;
  extensionId?: string;
  metadata?: JsonObject;
}

export interface TreeRendererState {
  expandedNodeIds: string[];
  expandedSectionIds: string[];
  selectedNodeId?: string;
}

export interface TreeRendererQueryParams {
  projectId?: string;
  modeId?: string;
  resource?: TreeRendererResourceRef;
  treeId: string;
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

export type TreeNodeTarget =
  | {
      kind: "command";
      commandId: string;
      args?: JsonObject;
    }
  | {
      kind: "resource";
      resource: TreeRendererResourceRef;
    }
  | {
      kind: "panel";
      widgetId: string;
    };

export interface TreeAction {
  id: string;
  label?: Localizable<string>;
  icon?: string;
  commandId?: string;
  args?: JsonObject;
  params?: ParamObjectSchema;
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
  bodyCommand: CommandRef<TreeRendererQueryParams, TreeViewSection[]> | string;
  childrenCommand?: CommandRef<TreeRendererChildrenParams, TreeNode[]> | string;
  footerCommand?: CommandRef<TreeRendererQueryParams, TreeNode[]> | string;
  defaultExpandedSectionIds?: string[];
  defaultExpandedNodeIds?: string[];
}

export type TreeRendererCommandResult = TreeViewSection[] | TreeNode[] | JsonValue;
