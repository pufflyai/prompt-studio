import type { WorkbenchCore } from "../../core";
import { panelPageDropTarget } from "../../core/controllers/composition/panel-page-drop";
import { findPlacementByWidgetId } from "../../core/registries/layout/layout-operations";

export const tabDragDestinations = (workbench: WorkbenchCore, id: string) => {
  const fromMain =
    workbench.pages.getContent()?.widgetId === id ||
    findPlacementByWidgetId(workbench.layout.getLayout(), id)?.regionId === "main";
  const regions = workbench
    .getPanelDestinations(id)
    .filter((region) => !fromMain || region === "main" || workbench.shell.getPanelPolicy(region).open);
  return panelPageDropTarget(workbench, id) && !regions.includes("main") ? [...regions, "main" as const] : regions;
};
