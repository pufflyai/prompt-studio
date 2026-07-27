import { text } from "pstdio-extensions/workbench";
import type { WorkbenchModuleContext } from "../../core";
import {
  registerWorkbenchExtensionPanel,
  toWorkbenchPanelEligibility,
  toWorkbenchPanelMenus,
} from "./panel-contributions";
import type { ExtensionTreePanelRecord } from "./tree-renderer-contribution-types";

interface RegisterTreeViewWidgetInput {
  workbench: WorkbenchModuleContext;
}

export const registerTreeViewWidget = (input: RegisterTreeViewWidgetInput, panel: ExtensionTreePanelRecord) => {
  if (!panel.treeRendererId) return undefined;
  return registerWorkbenchExtensionPanel({
    workbench: input.workbench,
    contribution: {
      id: panel.id,
      title: text(panel.title, panel.id),
      region: panel.region,
      closable: panel.closable,
      rendererId: panel.treeRendererId,
      singleton: true,
      resourceKinds: panel.resourceKind ? [panel.resourceKind] : undefined,
      eligibleLocations: toWorkbenchPanelEligibility(panel.eligibleLocations),
      panelMenus: toWorkbenchPanelMenus(panel.panelMenus),
    },
  });
};
