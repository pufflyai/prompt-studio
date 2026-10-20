import { type WorkbenchLayout, workbenchPanelRegions } from "../../registries/layout/layout-types";
import type { WorkbenchCore } from "../../workbench-core-types";
import { authoredPanelDestinations, panelDestinationPolicy } from "../composition/panel-destinations";
import { retainRestoredPanel } from "./restore-panel-retention";

// Cached destinations are user choices, subject to the same authored constraints
// as Move and Add. Repair them before availability removes unsupported regions.
export const restorePanelDestinations = (core: WorkbenchCore, layout: WorkbenchLayout) => {
  const regions = { ...layout.regions };
  let changed = false;
  for (const source of workbenchPanelRegions) {
    for (const tab of layout.regions[source].widgets) {
      const policy = panelDestinationPolicy(core, tab.contributionId, layout);
      const widget = core.layout.getWidget(tab.contributionId);
      const allowed = authoredPanelDestinations(policy).filter(
        // Authored content can occupy its own single-content panel. Moving a
        // resource elsewhere still requires a destination that accepts tabs.
        (region) => region === widget?.region || core.layout.getRegionSettings(region)?.acceptsTabs !== false,
      );
      if (allowed.includes(source)) continue;
      changed = true;
      const current = regions[source];
      const widgets = current.widgets.filter((widget) => widget.widgetId !== tab.widgetId);
      regions[source] = {
        ...current,
        widgets,
        activeWidgetId: current.activeWidgetId === tab.widgetId ? widgets[0]?.widgetId : current.activeWidgetId,
        visible: source === "main" || (current.visible && widgets.length > 0),
      };
      const destination = allowed.find((region) => region === widget?.region) ?? allowed[0];
      if (!destination) continue;
      retainRestoredPanel(core, tab);
      const target = regions[destination];
      regions[destination] = {
        ...target,
        // A repaired preview cannot replace another live preview at its destination.
        widgets: [...target.widgets, { ...tab, pinned: true, tabRetention: "persistent" }],
        activeWidgetId: target.activeWidgetId ?? tab.widgetId,
      };
    }
  }
  return changed ? { ...layout, regions } : layout;
};
