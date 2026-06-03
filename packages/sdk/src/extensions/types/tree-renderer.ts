import type { Localizable } from "../l10n";
import type { CommandRef } from "./commands";
import type { JsonObject, JsonValue } from "./json";

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
      kind: "view";
      widgetId: string;
    };

export interface TreeAction {
  id: string;
  label?: Localizable<string>;
  icon?: string;
  commandId?: string;
  args?: JsonObject;
  when?: string;
  disabled?: boolean;
}

export interface TreeNode {
  id: string;
  label: Localizable<string>;
  icon?: string;
  iconColor?: string;
  iconTooltip?: string;
  resource?: TreeRendererResourceRef;
  target?: TreeNodeTarget;
  actions?: TreeAction[];
  contextMenuActions?: TreeAction[];
  collapsible?: boolean;
  disabled?: boolean;
  children?: TreeNode[];
  description?: string;
  contextValue?: string;
  hiddenByDefault?: boolean;
  metadata?: JsonObject;
}

export interface TreeViewSection {
  id: string;
  label?: Localizable<string>;
  actions?: TreeAction[];
  collapsible?: boolean;
  nodes: TreeNode[];
  hiddenByDefault?: boolean;
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
