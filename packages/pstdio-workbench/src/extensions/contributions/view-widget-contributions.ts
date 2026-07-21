import type {
  Disposable,
  WidgetContribution,
  WorkbenchModuleContributionContext,
  WorkbenchPanelMenuRegion,
  WorkbenchPanelRegion,
} from "../../core";
import { workbenchPanelMenuRegions, workbenchPanelRegions } from "../../core";

export type WorkbenchExtensionViewRole = "location" | "sub-panel" | "panel-menu" | "modal";

export interface RegisterWorkbenchExtensionViewWidgetInput {
  contribution: Omit<WidgetContribution, "fallbackRegion" | "role">;
  role: WorkbenchExtensionViewRole;
  workbench: WorkbenchModuleContributionContext;
}

const panelMenuRegionIds = new Set(
  Object.values(workbenchPanelMenuRegions).flatMap((regions) => Object.values(regions)),
);

export const registerWorkbenchExtensionViewWidget = (input: RegisterWorkbenchExtensionViewWidgetInput): Disposable => {
  const { contribution, role, workbench } = input;
  if (role === "location") return workbench.layout.registerLocation(contribution);
  if (role === "modal") {
    return workbench.layout.registerWidget({ ...contribution, closable: true, region: "overlay" });
  }
  if (role === "sub-panel") {
    if (!workbenchPanelRegions.includes(contribution.region as WorkbenchPanelRegion)) {
      throw new Error(`Sub Panel view must target a Panel region: ${contribution.id}`);
    }
    return workbench.layout.registerSubPanel({
      ...contribution,
      region: contribution.region as WorkbenchPanelRegion,
    });
  }
  if (!panelMenuRegionIds.has(contribution.region as WorkbenchPanelMenuRegion)) {
    throw new Error(`Panel Menu view must target a Panel Menu region: ${contribution.id}`);
  }
  return workbench.layout.registerPanelMenu({
    ...contribution,
    region: contribution.region as WorkbenchPanelMenuRegion,
  });
};
