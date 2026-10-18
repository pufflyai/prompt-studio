import type { WorkbenchPanelRegion } from "../../registries/layout/layout-types";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import type { WorkbenchCore } from "../../workbench-core-types";

export const addPanelToRegion = async (
  core: WorkbenchCore,
  panelId: string,
  destination: WorkbenchPanelRegion,
  open: () => void | Promise<void>,
) => {
  const before = core.layout.getLayout();
  await open();
  const panel = core.layout.getActivePanel();
  if (panel?.panelId !== panelId) return;
  const source = Object.values(core.layout.getLayout().regions).find((region) =>
    region.widgets.some((widget) => widget.widgetId === panel.instanceId),
  );
  if (!source) return;
  batchWorkbenchChanges(() => {
    core.movePanel(panel.instanceId, destination);
    // Creation may use the tool's default region. Relocating that new tab is part
    // of adding it, so an already-empty source keeps the user's visibility choice.
    if (
      source.id === destination ||
      before.regions[source.id].widgets.length > 0 ||
      core.layout.listPanelInstances(source.id).length > 0
    )
      return;
    core.layout.setRegionVisible(source.id, before.regions[source.id].visible && source.visible);
  });
};
