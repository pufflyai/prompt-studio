import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { Localizable, ParamObjectSchema } from "@pstdio/sdk/extensions";

export type ExtensionTreeRendererRecord = NonNullable<WorkbenchExtensionMetadata["treeRenderers"]>[number];
export type ExtensionTreePanelRecord = WorkbenchExtensionMetadata["panels"][number];
export type ExtensionTreeViewRecord =
  | WorkbenchExtensionMetadata["panels"][number]
  | NonNullable<WorkbenchExtensionMetadata["panels"][number]["panelMenus"]>[number];

export interface ExtensionTreeResource {
  type: string;
  id: string;
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface ExtensionTreeTarget {
  kind: "command" | "resource" | "panel";
  commandId?: string;
  args?: Record<string, unknown>;
  resource?: ExtensionTreeResource;
  panelId?: string;
}

export interface ExtensionTreeAction {
  id: string;
  label?: Localizable<string>;
  icon?: string;
  commandId?: string;
  args?: Record<string, unknown>;
  params?: ParamObjectSchema;
  submitLabel?: string;
  when?: string;
  disabled?: boolean;
}

export interface ExtensionTreeSectionEmptyState {
  title: Localizable<string>;
  description?: Localizable<string>;
  icon?: string;
}

export type ExtensionTreeNodeRowVariant = "empty-state";

export interface ExtensionTreeNode {
  id: string;
  label: Localizable<string>;
  icon?: string;
  iconColor?: string;
  iconTooltip?: string;
  resource?: ExtensionTreeResource;
  target?: ExtensionTreeTarget;
  rowVariant?: ExtensionTreeNodeRowVariant;
  actions?: ExtensionTreeAction[];
  contextMenuActions?: ExtensionTreeAction[];
  collapsible?: boolean;
  disabled?: boolean;
  selected?: boolean;
  children?: ExtensionTreeNode[];
  description?: string;
  contextValue?: string;
  hiddenByDefault?: boolean;
  canHide?: boolean;
}

export interface ExtensionTreeSection {
  id: string;
  label?: Localizable<string>;
  actions?: ExtensionTreeAction[];
  collapsible?: boolean;
  emptyState?: ExtensionTreeSectionEmptyState;
  nodes: ExtensionTreeNode[];
  hiddenByDefault?: boolean;
  canHide?: boolean;
}

export interface TargetCommandArgs {
  commandId: string;
  nodeId?: string;
  params?: Record<string, unknown>;
  resource?: ExtensionTreeResource;
  treeId: string;
}
