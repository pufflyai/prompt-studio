import type { WorkbenchPanelRegion, WorkbenchTabPosition } from "../../registries/layout/layout-types";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import type { WorkbenchCore } from "../../workbench-core-types";
import { prepareWorkbenchNavigation } from "../navigation/compound-navigation";
import { portablePagePanel } from "../page-runtime/portable-page-panel";
import { allowedPanelDestinations } from "./panel-destinations";

export const pageContentDestinations = (core: WorkbenchCore, instanceId: string) => {
  if (core.pages.getContent()?.widgetId !== instanceId) return;
  const modeId = core.modes.getActiveModeId();
  return allowedPanelDestinations(modeId ? core.modes.getMode(modeId) : undefined).filter((region) => {
    const policy = core.shell.getPanelPolicy(region);
    return region !== "main" && policy.acceptsTabs && (policy.open || policy.canOpen);
  });
};

export const movePageContent = (
  core: WorkbenchCore,
  destination: WorkbenchPanelRegion,
  position: WorkbenchTabPosition,
) => {
  const source = core.pages.getContent()!;
  const state = core.pages.store.getState();
  const page = state.pages[state.activePageId!]!;
  const ref = portablePagePanel(page, core.modePlacements)!;
  const declaration = core.modePlacements.getPlacement(ref)!;
  const prepared = prepareWorkbenchNavigation(
    core,
    [
      {
        kind: "panel",
        panel: ref,
        region: destination,
        resource: source.resource,
        ...(declaration.item.kind === "binding" && declaration.item.binding.cardinality === "many"
          ? { open: "pin" as const }
          : {}),
      },
    ],
    {
      location: {
        section: source.section,
        position: source.position,
        pageContext: source.pageContext ?? {
          page: state.location!.page,
          parent: state.location!.parent,
          params: state.location!.params,
        },
      },
    },
  );
  batchWorkbenchChanges(() => {
    prepared.commit();
    const moved = core.layout.getActivePanel(destination);
    if (moved && position !== "end") core.layout.reorderPanel(moved.instanceId, position);
    core.focus.setActiveRegion(destination);
  });
};
