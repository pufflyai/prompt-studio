import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { pinPagePlacement } from "../../registries/pages/page-placement-pin";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import type { OwnedPlacementState } from "../../registries/placements/owned-placement-lifecycle";
import { getOwnedPlacementPreparation } from "../../registries/placements/owned-placement-preparation";
import type { WorkbenchCore } from "../../workbench-core-types";

export const prepareEditorRetention = (
  core: WorkbenchCore,
  tab: WorkbenchWidgetPlacement,
  current: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  modeState: OwnedPlacementState,
  shellState: OwnedPlacementState,
) => {
  const identity = tab.placementIdentity;
  if (!identity || tab.declarationIdentity || tab.tabRetention !== "preview")
    return { state: current, modeState, shellState };
  const pages = getWorkbenchPageRegistryInternals(core.pages);
  const mode = getOwnedPlacementPreparation(core.modePlacements);
  const shell = getOwnedPlacementPreparation(core.shellPlacements);
  let next = current;
  if (identity.kind === "page") next = pinPagePlacement(current, identity, pages.resources);
  else {
    const target = { placementId: identity.placementId, resource: tab.resource, open: "pin" as const };
    if (identity.kind === "mode") modeState = mode.open(target, modeState).state;
    else shellState = shell.open(target, shellState).state;
  }
  return {
    state: pages.prepare.compose(
      current,
      { ...next, activate: [identity], action: "prepareEditorRetention" },
      {
        mode: mode.resolve(current.activeModeId, modeState),
        shell: shell.resolve(undefined, shellState),
      },
    ),
    modeState,
    shellState,
  };
};
