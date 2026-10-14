import { resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchPanelRegion, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import type { NavigationTargetPanel } from "../../registries/navigation/navigation-registry";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { shellPlacementContributionId } from "../../registries/placements/shell-placement-registry";
import { modePlacementContributionId, pagePlacementContributionId } from "../../registries/views/view-placement";
import type { WorkbenchCore } from "../../workbench-core-types";
import { panelDestinations } from "../composition/panel-destinations";
import { readSavedOwnerPlacements } from "../page-runtime/owner-layout-resolution";

export type PreparedPanelTarget = NavigationTargetPanel & { destination?: WorkbenchPanelRegion };

const panelDeclaration = (
  core: WorkbenchCore,
  target: PreparedPanelTarget,
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
) => {
  const panel = target.panel;
  if (panel.kind === "placement") {
    const declaration = core.modePlacements.getPlacement(panel);
    return declaration && { region: declaration.region, id: modePlacementContributionId(declaration.id) };
  }
  if (panel.kind === "shell-placement") {
    const declaration = core.shellPlacements.getPlacement(panel.id);
    return declaration && { region: declaration.region, id: shellPlacementContributionId(declaration.id) };
  }
  const page = state.activePageId ? state.pages[state.activePageId] : undefined;
  const slot = page?.slots.find((slot) => slot.id === panel.id);
  return page && slot && { region: slot.region, id: pagePlacementContributionId(page.id, slot.id) };
};

export const validatePanelNavigation = (
  core: WorkbenchCore,
  target: PreparedPanelTarget,
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
) => {
  const declaration = panelDeclaration(core, target, state);
  if (!declaration) return;
  const singleton = core.layout.getWidget(declaration.id)?.singleton;
  const pageInstanceIds = new Set(
    state.placements
      .filter((placement) => placement.value.contributionId === declaration.id)
      .map((placement) => placement.value.widgetId),
  );
  const saved =
    readSavedOwnerPlacements(core.pages, state) ??
    Object.values(core.layout.getLayout().regions).flatMap((region) =>
      region.widgets.map((value) => ({ region: region.id, value })),
    );
  const existing = saved.find(
    ({ value: tab }) =>
      tab.contributionId === declaration.id &&
      (target.panel.kind !== "page-slot" || pageInstanceIds.has(tab.widgetId)) &&
      (singleton || !target.resource || tab.resourceKey === resourceKey(target.resource)),
  );
  const region = target.destination ?? existing?.region ?? declaration.region;
  if (target.destination && !panelDestinations(core, declaration.id).includes(target.destination))
    throw new Error(`Panel cannot move to ${target.destination}: ${declaration.id}`);
  if (region !== "main" && region !== "secondary" && region !== "side" && region !== "bottom" && region !== "aside")
    return;
  const policy = core.shell.getPanelPolicy(region, {
    modeId: state.activeModeId ?? core.modes.getActiveModeId(),
    pageId: state.activePageId,
    projectId: state.projectId,
    resource: state.location?.resource,
  });
  if (!policy.provided) throw new Error(`Panel is not provided: ${region}`);
  if (!existing && !policy.acceptsTabs) throw new Error(`Panel cannot accept tabs: ${region}`);
  if (!policy.open && !policy.canOpen) throw new Error(`Panel cannot open: ${region}`);
};
