import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { text } from "pstdio-extensions/workbench";
import type {
  Disposable,
  WorkbenchModuleContext,
  WorkbenchPanelContribution,
  WorkbenchPanelMenuDefinition,
  WorkbenchViewContribution,
} from "../../core";
import { BRIDGE_WEBVIEW_RENDERER_ID } from "../bridge/bridge-webview-renderer";
import { toBridgeWebviewConfig } from "../bridge/webview-contribution-config";

type ExtensionPanelRecord = WorkbenchExtensionMetadata["panels"][number];
type ExtensionPanelMenu = NonNullable<ExtensionPanelRecord["panelMenus"]>[number];
type ExtensionResourcePanels = WorkbenchExtensionMetadata["resourcePanels"];

export interface RegisterWorkbenchExtensionPanelInput {
  contribution: WorkbenchPanelContribution;
  path?: string;
  aliases?: readonly string[];
  resolveInput?: WorkbenchViewContribution["resolveInput"];
  workbench: WorkbenchModuleContext;
}

// Panels keep manifest declaration order until the user reorders them.
export const declarationPriority = (declarationIndex = 0) => ({ priority: -declarationIndex });

// A panel with an unscoped placement is available without a resource. Otherwise,
// its own scoped placements and cross-extension edges define the kinds it serves.
export const panelResourceKinds = (
  panel: ExtensionPanelRecord,
  resourcePanels: ExtensionResourcePanels | undefined,
) => {
  const show = panel.show ? (Array.isArray(panel.show) ? panel.show : [panel.show]) : [];
  if (show.some((placement) => placement.for === undefined)) return undefined;
  const kinds = [
    ...show.flatMap((placement) => (placement.for ? [placement.for] : [])),
    ...(resourcePanels ?? []).filter((edge) => edge.panel === panel.id).map((edge) => edge.resourceKind),
  ].filter((kind, index, all) => all.indexOf(kind) === index);
  return kinds.length > 0 ? kinds : undefined;
};

const panelDefaultRegion = (panel: ExtensionPanelRecord) => {
  const show = panel.show ? (Array.isArray(panel.show) ? panel.show : [panel.show]) : [];
  return show[0]?.region ?? "main";
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
  region: panelDefaultRegion(input.panel),
  rendererId: input.rendererId,
  singleton: true,
  resourceKinds: panelResourceKinds(input.panel, input.resourcePanels),
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

export const registerWorkbenchExtensionPanel = (input: RegisterWorkbenchExtensionPanelInput): Disposable => {
  const panel = input.workbench.layout.registerPanel(input.contribution);
  let view: Disposable;
  try {
    view = input.workbench.views.registerView({
      id: input.contribution.id,
      panelId: input.contribution.id,
      title: input.contribution.title,
      icon: input.contribution.icon,
      path: input.path,
      aliases: input.aliases,
      resolveInput: input.resolveInput,
    });
  } catch (error) {
    panel.dispose();
    throw error;
  }
  return {
    dispose() {
      view.dispose();
      panel.dispose();
    },
  };
};

export const panelRendererId = (
  panel: ExtensionPanelRecord,
  kind: NonNullable<ExtensionPanelRecord["renderer"]>["kind"],
) => (panel.renderer?.kind === kind ? panel.renderer.id : undefined);
