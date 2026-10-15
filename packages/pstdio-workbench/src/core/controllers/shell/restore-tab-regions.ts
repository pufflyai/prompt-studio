import type {
  WorkbenchLayout,
  WorkbenchPanelRegion,
  WorkbenchWidgetPlacement,
} from "../../registries/layout/layout-types";
import { workbenchPanelRegions } from "../../registries/layout/layout-types";
import { isPageRegion } from "../../registries/layout/owner-region-state";
import type { WorkbenchCore } from "../../workbench-core-types";
import { allowedPanelDestinations, panelDestinationPolicy } from "../composition/panel-destinations";
import { transferPanelOwner } from "../composition/panel-owner-transfer";
import { presetDeclaration } from "../composition/preset-declaration";

const restoredTabDestination = (
  core: WorkbenchCore,
  tab: WorkbenchWidgetPlacement,
  source: WorkbenchPanelRegion,
  layout: WorkbenchLayout,
) => {
  const widget = core.layout.getWidget(tab.contributionId);
  if (!widget) return undefined;
  const identity = tab.declarationIdentity ?? tab.placementIdentity;
  const declaration = identity && presetDeclaration(core, identity);
  const authored = declaration?.region ?? widget.region;
  const movableTo =
    identity?.kind === "mode"
      ? core.modePlacements.listPlacements(identity.modeId).find((p) => p.id === identity.placementId)?.movableTo
      : undefined;
  const destinations = allowedPanelDestinations({
    ...panelDestinationPolicy(core, tab.contributionId, layout),
    movableTo,
  });
  const allowed = destinations.filter((region) => {
    const policy = core.shell.getPanelPolicy(region);
    return authored === region || (policy.acceptsTabs && (policy.open || policy.canOpen));
  });
  if (allowed.includes(source)) return undefined;
  const owner = tab.placementIdentity;
  const owned = allowed.filter((region) => isPageRegion(region) === (owner?.kind === "page"));
  if ((owner?.kind === "page" || owner?.kind === "mode") && owned.length)
    return owned.find((region) => region === authored) ?? owned[0];
  return allowed.find((region) => region === authored) ?? allowed[0];
};

export const restoreTabRegions = (core: WorkbenchCore, layout: WorkbenchLayout) => {
  let changed = false;
  const regions = { ...layout.regions };
  for (const source of workbenchPanelRegions) {
    for (const tab of layout.regions[source].widgets) {
      const destination = restoredTabDestination(core, tab, source, layout);
      if (!destination) continue;
      changed = true;
      regions[source] = {
        ...regions[source],
        widgets: regions[source].widgets.filter((p) => p.widgetId !== tab.widgetId),
        activeWidgetId: regions[source].activeWidgetId === tab.widgetId ? undefined : regions[source].activeWidgetId,
      };
      regions[destination] = {
        ...regions[destination],
        widgets: [
          ...regions[destination].widgets,
          tab.placementIdentity ? transferPanelOwner(core, tab, destination) : tab,
        ],
        activeWidgetId: layout.activeWidgetId === tab.widgetId ? tab.widgetId : regions[destination].activeWidgetId,
      };
    }
  }
  return changed ? { ...layout, regions } : layout;
};
