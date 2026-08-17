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
type ExtensionPanelPlacement = NonNullable<WorkbenchExtensionMetadata["panels"][number]["placement"]>;

interface WorkbenchExtensionPlacementInput {
  placement?: ExtensionPanelPlacement;
  declarationIndex?: number;
}

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

const placementBasePriority = {
  first: 1_000_000,
  default: 0,
  last: -1_000_000,
} satisfies Record<ExtensionPanelPlacement, number>;

export const toWorkbenchExtensionPlacementMetadata = (input: WorkbenchExtensionPlacementInput) => ({
  priority: placementBasePriority[input.placement ?? "default"] - (input.declarationIndex ?? 0),
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
    ...toWorkbenchExtensionPlacementMetadata({
      placement: menu.placement,
      declarationIndex: declarationOffset + index,
    }),
  }));

export const registerWorkbenchExtensionPanel = (input: RegisterWorkbenchExtensionPanelInput): Disposable =>
  input.workbench.layout.registerPanel(input.contribution);

export const panelRendererId = (
  panel: WorkbenchExtensionMetadata["panels"][number],
  kind: NonNullable<WorkbenchExtensionMetadata["panels"][number]["renderer"]>["kind"],
) => (panel.renderer?.kind === kind ? panel.renderer.id : undefined);
