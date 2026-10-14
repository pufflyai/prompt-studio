import type {
  WorkbenchLayout,
  WorkbenchPanelRegion,
  WorkbenchWidgetPlacement,
} from "../../registries/layout/layout-types";
import { workbenchPanelRegions } from "../../registries/layout/layout-types";
import { isWorkbenchModePanelAvailable } from "../../registries/modes/mode-layout";
import type { WorkbenchCore } from "../../workbench-core-types";
import { presetDeclaration } from "../composition/preset-declaration";

const restoredTabDestination = (
  core: WorkbenchCore,
  tab: WorkbenchWidgetPlacement,
  source: WorkbenchPanelRegion,
  available: WorkbenchPanelRegion[],
) => {
  if (!core.layout.getWidget(tab.contributionId)) return undefined;
  const identity = tab.declarationIdentity ?? tab.placementIdentity;
  const declaration = identity && presetDeclaration(core, identity);
  const movableTo =
    identity?.kind === "mode"
      ? core.modePlacements.listPlacements(identity.modeId).find((p) => p.id === identity.placementId)?.movableTo
      : undefined;
  const allowed = available.filter((region) => !movableTo || movableTo.some((candidate) => candidate === region));
  if (allowed.includes(source)) return undefined;
  const authored = declaration?.region;
  return allowed.find((region) => region === authored) ?? allowed[0];
};

export const restoreTabRegions = (core: WorkbenchCore, layout: WorkbenchLayout) => {
  const mode = core.modes.getMode(core.modes.getActiveModeId() ?? "");
  const available = workbenchPanelRegions.filter((region) => isWorkbenchModePanelAvailable(mode, region));
  let changed = false;
  const regions = { ...layout.regions };
  for (const source of workbenchPanelRegions) {
    for (const tab of layout.regions[source].widgets) {
      const destination = restoredTabDestination(core, tab, source, available);
      if (!destination) continue;
      changed = true;
      regions[source] = {
        ...regions[source],
        widgets: regions[source].widgets.filter((p) => p.widgetId !== tab.widgetId),
        activeWidgetId: regions[source].activeWidgetId === tab.widgetId ? undefined : regions[source].activeWidgetId,
      };
      regions[destination] = {
        ...regions[destination],
        widgets: [...regions[destination].widgets, tab],
        activeWidgetId: layout.activeWidgetId === tab.widgetId ? tab.widgetId : regions[destination].activeWidgetId,
      };
    }
  }
  return changed ? { ...layout, regions } : layout;
};
