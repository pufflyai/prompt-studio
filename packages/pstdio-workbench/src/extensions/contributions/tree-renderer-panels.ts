import { text } from "pstdio-extensions/workbench";
import type { WorkbenchModuleContext } from "../../core";
import {
  panelRendererId,
  registerWorkbenchExtensionPanel,
  toWorkbenchExtensionPlacementMetadata,
  toWorkbenchPanelEligibility,
  toWorkbenchPanelMenus,
} from "./panel-contributions";
import type { ExtensionTreePanelRecord } from "./tree-renderer-contribution-types";

interface RegisterTreeViewWidgetInput {
  workbench: WorkbenchModuleContext;
}

export const registerTreeViewWidget = (
  input: RegisterTreeViewWidgetInput,
  panel: ExtensionTreePanelRecord,
  index: number,
  menuDeclarationOffset: number,
) => {
  const rendererId = panelRendererId(panel, "tree");
  if (!rendererId) return undefined;
  return registerWorkbenchExtensionPanel({
    workbench: input.workbench,
    contribution: {
      id: panel.id,
      title: text(panel.title, panel.id),
      icon: panel.icon,
      region: panel.region,
      closable: panel.closable,
      rendererId,
      singleton: true,
      resourceKinds: panel.resourceKind ? [panel.resourceKind] : undefined,
      eligibleLocations: toWorkbenchPanelEligibility(panel.eligibleLocations),
      panelMenus: toWorkbenchPanelMenus(panel.panelMenus, menuDeclarationOffset),
      ...toWorkbenchExtensionPlacementMetadata({ placement: panel.placement, declarationIndex: index }),
    },
  });
};
