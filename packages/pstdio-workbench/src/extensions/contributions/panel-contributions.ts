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

type ExtensionPanelRecord = WorkbenchExtensionMetadata["panels"][number];
type ExtensionPanelMenu = NonNullable<ExtensionPanelRecord["panelMenus"]>[number];
type ExtensionResourcePanels = WorkbenchExtensionMetadata["resourcePanels"];

export interface RegisterWorkbenchExtensionPanelInput {
  contribution: WorkbenchPanelContribution;
  workbench: WorkbenchModuleContext;
}

// Panels keep manifest declaration order until the user reorders them.
export const declarationPriority = (declarationIndex = 0) => ({ priority: -declarationIndex });

// The resource kinds a panel serves come from its resource-panel edges; the panel
// capability itself no longer names resource kinds.
export const panelResourceKinds = (panelId: string, resourcePanels: ExtensionResourcePanels | undefined) => {
  const kinds = (resourcePanels ?? [])
    .filter((edge) => edge.panel === panelId)
    .map((edge) => edge.resourceKind)
    .filter((kind, index, all) => all.indexOf(kind) === index);
  return kinds.length > 0 ? kinds : undefined;
};

// Registers a metadata panel as a workbench widget. The widget's region is only the
// fallback for direct opens; the composition resolver places the panel per active
// mode-resource context and owns required-state closability.
export const toWorkbenchCompositionPanelContribution = (input: {
  panel: ExtensionPanelRecord;
  rendererId: string;
  declarationIndex: number;
  menuDeclarationOffset: number;
  resourcePanels?: ExtensionResourcePanels;
  config?: WorkbenchPanelContribution["config"];
}): WorkbenchPanelContribution => ({
  id: input.panel.id,
  title: text(input.panel.title, input.panel.id),
  icon: input.panel.icon,
  region: input.panel.supportedRegions[0] ?? "main",
  closable: true,
  rendererId: input.rendererId,
  singleton: true,
  resourceKinds: panelResourceKinds(input.panel.id, input.resourcePanels),
  panelMenus: toWorkbenchPanelMenus(input.panel.panelMenus, input.menuDeclarationOffset),
  config: input.config,
  ...declarationPriority(input.declarationIndex),
});

// Panel menus tie-break by manifest declaration order across every owner panel,
// not just within one panel. Returns each panel's menu count prefix so callers
// can hand every menu a unique declaration index in manifest order.
export const panelMenuDeclarationOffsets = <T extends { panelMenus?: readonly unknown[] }>(
  panels: readonly T[],
): number[] => {
  const offsets: number[] = [];
  let total = 0;
  for (const panel of panels) {
    offsets.push(total);
    total += panel.panelMenus?.length ?? 0;
  }
  return offsets;
};

const panelMenuRendererId = (menu: ExtensionPanelMenu) => {
  const rendererId = menu.renderer?.id ?? (menu.webview ? BRIDGE_WEBVIEW_RENDERER_ID : undefined);
  if (!rendererId) throw new Error(`Panel Menu has no renderer: ${menu.id}`);
  return rendererId;
};

const menuPlacementBasePriority = { first: 1_000_000, default: 0, last: -1_000_000 } as const;

export const toWorkbenchPanelMenus = (
  menus: readonly ExtensionPanelMenu[] | undefined,
  declarationOffset = 0,
): WorkbenchPanelMenuDefinition[] | undefined =>
  menus?.map((menu, index) => ({
    id: menu.id,
    title: text(menu.title, menu.id),
    side: menu.side,
    rendererId: panelMenuRendererId(menu),
    config: menu.webview ? toBridgeWebviewConfig(menu.webview) : undefined,
    priority: menuPlacementBasePriority[menu.placement ?? "default"] - (declarationOffset + index),
  }));

export const registerWorkbenchExtensionPanel = (input: RegisterWorkbenchExtensionPanelInput): Disposable =>
  input.workbench.layout.registerPanel(input.contribution);

export const panelRendererId = (
  panel: ExtensionPanelRecord,
  kind: NonNullable<ExtensionPanelRecord["renderer"]>["kind"],
) => (panel.renderer?.kind === kind ? panel.renderer.id : undefined);
