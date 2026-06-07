import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { Localizable, ParamObjectSchema } from "@pstdio/sdk/extensions";

export type ExtensionTreeRendererRecord = NonNullable<WorkbenchExtensionMetadata["treeRenderers"]>[number];
export type ExtensionTreeViewRecord = WorkbenchExtensionMetadata["views"][number];

export interface ExtensionTreeResource {
  type: string;
  id: string;
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface ExtensionTreeTarget {
  kind: "command" | "resource" | "view";
  commandId?: string;
  args?: Record<string, unknown>;
  resource?: ExtensionTreeResource;
  widgetId?: string;
}

export interface ExtensionTreeAction {
  id: string;
  label?: Localizable<string>;
  icon?: string;
  commandId?: string;
  args?: Record<string, unknown>;
  params?: ParamObjectSchema;
  when?: string;
  disabled?: boolean;
}

export interface ExtensionTreeNode {
  id: string;
  label: Localizable<string>;
  icon?: string;
  iconColor?: string;
  iconTooltip?: string;
  resource?: ExtensionTreeResource;
  target?: ExtensionTreeTarget;
  actions?: ExtensionTreeAction[];
  contextMenuActions?: ExtensionTreeAction[];
  collapsible?: boolean;
  disabled?: boolean;
  children?: ExtensionTreeNode[];
  description?: string;
  contextValue?: string;
  hiddenByDefault?: boolean;
}

export interface ExtensionTreeSection {
  id: string;
  label?: Localizable<string>;
  actions?: ExtensionTreeAction[];
  collapsible?: boolean;
  nodes: ExtensionTreeNode[];
  hiddenByDefault?: boolean;
}

export interface TargetCommandArgs {
  commandId: string;
  nodeId?: string;
  params?: Record<string, unknown>;
  resource?: ExtensionTreeResource;
  treeId: string;
}
