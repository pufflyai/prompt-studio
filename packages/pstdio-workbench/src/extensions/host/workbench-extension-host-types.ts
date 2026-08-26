import type { CommandExecuteRequest, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type {
  Disposable,
  MenuItem,
  MenuPath,
  ResourceRef,
  WorkbenchCommandExecutionContext,
  WorkbenchModuleContext,
} from "../../core";
import type {
  CreateBridgeWebviewHostCapabilities,
  CreateBridgeWebviewProps,
  CreateBridgeWebviewTheme,
} from "../bridge/bridge-webview-renderer";
import type { ExtensionWebviewFileCapabilities } from "../bridge/webview-command-capabilities";
import type {
  WorkbenchExtensionMenuRegistration,
  WorkbenchExtensionMenuSlotConfig,
  WorkbenchExtensionMenuWhenBuilder,
} from "../contributions/extension-contributions";
import type { WorkbenchExtensionKanbanRendererAdapter } from "../contributions/kanban-renderer-contributions";
import type { WorkbenchExtensionViewInputResolver } from "../contributions/panel-contributions";
import type { RegisterWorkbenchExtensionTreeRenderersInput } from "../contributions/tree-renderer-contributions";
import type { InternalWorkbenchExtensionMetadata } from "./internal-workbench-extension-metadata";
import type { WorkbenchExtensionRefreshEvent } from "./workbench-extension-refresh";

export interface WorkbenchExtensionHostMenuRegistration
  extends Omit<WorkbenchExtensionMenuRegistration, "menuItem" | "menuPath"> {
  menuItems: Array<{ menuItem: MenuItem; menuPath: MenuPath }>;
}

export interface RegisterWorkbenchExtensionContributionsInput {
  createMenuWhenExpression?: WorkbenchExtensionMenuWhenBuilder;
  createWebviewHostCapabilities?: CreateBridgeWebviewHostCapabilities;
  createWebviewHostCapabilityOverrides?: CreateBridgeWebviewHostCapabilities;
  createWebviewProps?: CreateBridgeWebviewProps;
  createWebviewTheme?: CreateBridgeWebviewTheme;
  executeCommand(commandId: string, body: CommandExecuteRequest): Promise<unknown> | unknown;
  kanbanAdapter?: WorkbenchExtensionKanbanRendererAdapter;
  menuSlotsById?: ReadonlyMap<string, WorkbenchExtensionMenuSlotConfig>;
  menuTargetsById?: ReadonlyMap<string, WorkbenchExtensionMenuSlotConfig>;
  menuRegistrations?: readonly WorkbenchExtensionHostMenuRegistration[];
  metadata: WorkbenchExtensionMetadata;
  openHref?: (href: string) => unknown;
  prepareCommandArgs?(
    commandId: string,
    args: unknown,
    context?: WorkbenchCommandExecutionContext,
    onArgsChange?: (args: unknown) => void,
  ): Promise<unknown> | unknown;
  prepareResource?: (resource: ResourceRef) => void;
  projectId: string;
  resolveViewInput?: WorkbenchExtensionViewInputResolver;
  resolveTreeNodeResource?: RegisterWorkbenchExtensionTreeRenderersInput["resolveNodeResource"];
  settingsSectionId?: string;
  settingsSectionTitle?: string;
  subscribeRefreshEvents?: (listener: (event: WorkbenchExtensionRefreshEvent) => void) => Disposable;
  webviewFiles?: ExtensionWebviewFileCapabilities;
  workbench: WorkbenchModuleContext;
}

export type InternalRegisterWorkbenchExtensionContributionsInput = Omit<
  RegisterWorkbenchExtensionContributionsInput,
  "metadata"
> & { metadata: InternalWorkbenchExtensionMetadata };
