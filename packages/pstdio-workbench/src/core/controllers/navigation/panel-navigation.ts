import type { WorkbenchPanelRegion } from "../../registries/layout/layout-types";
import type { NavigationTargetPanel } from "../../registries/navigation/navigation-registry";
import type { WorkbenchCore } from "../../workbench-core-types";
import { prepareWorkbenchNavigation } from "./compound-navigation";

export const openWorkbenchPanel = (
  core: WorkbenchCore,
  target: NavigationTargetPanel,
  region?: WorkbenchPanelRegion,
) => {
  const result = prepareWorkbenchNavigation(core, [target]).commit();
  const active = core.layout.getActivePanel();
  if (region && active) core.movePanel(active.instanceId, region);
  return result;
};
