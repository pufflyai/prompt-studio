import type { WorkbenchCore } from "../../core";

export const updateTerminalPlacementTitle = (workbench: WorkbenchCore, instanceId: string, title: string) => {
  const current = Object.values(workbench.layout.getLayout().regions)
    .flatMap((region) => region.widgets)
    .find((p) => p.widgetId === instanceId);
  if (!current?.resource) return;
  const resource = { ...current.resource, label: title };
  if (current.placementIdentity?.kind === "shell") {
    workbench.shellPlacements.updatePlacement(current.placementIdentity, { resource });
    return;
  }
  workbench.layout.updateWidgetPlacement(instanceId, { resource, title });
};
