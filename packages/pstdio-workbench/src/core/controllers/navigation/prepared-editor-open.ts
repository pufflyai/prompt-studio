import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { pinPagePlacement } from "../../registries/pages/page-placement-pin";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import type { OwnedPlacementState } from "../../registries/placements/owned-placement-lifecycle";
import { getOwnedPlacementPreparation } from "../../registries/placements/owned-placement-preparation";
import type { WorkbenchCore } from "../../workbench-core-types";
import type { ResourceEditorIntent } from "./resource-editor-intent";

export const prepareEditorOpen = (
  core: WorkbenchCore,
  tab: WorkbenchWidgetPlacement,
  intent: ResourceEditorIntent,
  current: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  modeState: OwnedPlacementState,
  shellState: OwnedPlacementState,
) => {
  const identity = tab.placementIdentity;
  if (!identity || tab.declarationIdentity || (!intent.resource && intent.open !== "pin"))
    return { state: current, modeState, shellState };
  const pages = getWorkbenchPageRegistryInternals(core.pages);
  const mode = getOwnedPlacementPreparation(core.modePlacements);
  const shell = getOwnedPlacementPreparation(core.shellPlacements);
  let next = current;
  if (identity.kind === "page") {
    if (identity.slotId !== "$main" && intent.resource) {
      return {
        state: pages.prepare.slot(
          {
            pageId: identity.pageId,
            slotId: identity.slotId,
            resource: intent.resource,
            open: tab.tabRetention ? intent.open : undefined,
          },
          current,
          {
            mode: mode.resolve(current.activeModeId, modeState),
            shell: shell.resolve(undefined, shellState),
          },
        ),
        modeState,
        shellState,
      };
    }
    if (intent.open === "pin" && tab.tabRetention === "preview")
      next = pinPagePlacement(current, identity, pages.resources);
  } else {
    const target = {
      placementId: identity.placementId,
      resource: intent.resource ?? tab.resource,
      title: intent.title,
      open: tab.tabRetention ? intent.open : undefined,
    };
    if (identity.kind === "mode") modeState = mode.open(target, modeState).state;
    else shellState = shell.open(target, shellState).state;
  }
  return {
    state: pages.prepare.compose(
      current,
      { ...next, activate: [identity], action: "prepareEditorOpen" },
      {
        mode: mode.resolve(current.activeModeId, modeState),
        shell: shell.resolve(undefined, shellState),
      },
    ),
    modeState,
    shellState,
  };
};
