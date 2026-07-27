import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { text } from "pstdio-extensions/workbench";
import type {
  Disposable,
  WorkbenchModuleContext,
  WorkbenchPanelContribution,
  WorkbenchPanelMenuDefinition,
} from "../../core";
import { BRIDGE_WEBVIEW_RENDERER_ID } from "../bridge/bridge-webview-renderer";
import { toBridgeWebviewConfig } from "../bridge/webview-contribution-config";

type ExtensionPanelMenu = NonNullable<WorkbenchExtensionMetadata["panels"][number]["panelMenus"]>[number];

export interface RegisterWorkbenchExtensionPanelInput {
  contribution: WorkbenchPanelContribution;
  workbench: WorkbenchModuleContext;
}

export const toWorkbenchPanelEligibility = (eligibility?: { resourceKinds?: readonly string[] }) =>
  eligibility
    ? {
        resourceKinds: eligibility.resourceKinds ? [...eligibility.resourceKinds] : undefined,
      }
    : undefined;

const panelMenuRendererId = (menu: ExtensionPanelMenu) => {
  const rendererId =
    menu.treeRendererId ??
    menu.fileRendererId ??
    menu.controlsRendererId ??
    menu.dataTableRendererId ??
    (menu.webview ? BRIDGE_WEBVIEW_RENDERER_ID : undefined);
  if (!rendererId) throw new Error(`Panel Menu has no renderer: ${menu.id}`);
  return rendererId;
};

export const toWorkbenchPanelMenus = (
  menus: readonly ExtensionPanelMenu[] | undefined,
): WorkbenchPanelMenuDefinition[] | undefined =>
  menus?.map((menu) => ({
    id: menu.id,
    title: text(menu.title, menu.id),
    side: menu.side,
    rendererId: panelMenuRendererId(menu),
    config: menu.webview ? toBridgeWebviewConfig(menu.webview) : undefined,
  }));

export const registerWorkbenchExtensionPanel = (input: RegisterWorkbenchExtensionPanelInput): Disposable =>
  input.workbench.layout.registerPanel(input.contribution);
