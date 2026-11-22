import type { NavigationTargetPage } from "@pstdio/sdk/extensions";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import type { OwnedPlacementState } from "../../registries/placements/owned-placement-lifecycle";
import { getOwnedPlacementPreparation } from "../../registries/placements/owned-placement-preparation";
import type { WorkbenchCore } from "../../workbench-core-types";
import { getPageLocationPreparation } from "../page-location/page-location-preparation";
import type { ResolvedPageLocation } from "../page-location/page-location-types";
import { preparePageLanding } from "../page-runtime/page-panel-view";

type PageState = WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>;
const requireProject = (state: PageState) => {
  if (!state.projectId) throw new Error("Cannot navigate before a project is active");
  return state.projectId;
};

const placementContext = (state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>) =>
  state.activeModeId
    ? {
        modeId: state.activeModeId,
        pageId: state.activePageId,
        projectId: state.projectId,
        location: state.location,
      }
    : undefined;
const restorePageOwners = (
  core: WorkbenchCore,
  state: PageState,
  resolved: ResolvedPageLocation,
  modeState: OwnedPlacementState,
  shellState: OwnedPlacementState,
) => {
  const page = state.pages[resolved.pageId]!;
  const context = {
    modeId: page.modeId,
    pageId: page.id,
    projectId: requireProject(state),
    location: resolved.location,
  };
  const shell = getOwnedPlacementPreparation(core.shellPlacements);
  const mode = getOwnedPlacementPreparation(core.modePlacements);
  const nextShell = shell.restore?.(context, shellState, placementContext(state)) ?? shellState;
  const restored = state.activeModeId === page.modeId ? modeState : (mode.restore?.(context, modeState) ?? modeState);
  const landing = preparePageLanding(page, core.modePlacements, restored, resolved);
  const nextMode = landing?.state ?? restored;
  return {
    mode: nextMode,
    shell: nextShell,
    placements: {
      shell: shell.resolve(undefined, nextShell),
      mode: mode.resolve(page.modeId, nextMode),
      ...(landing ? { landing: landing.identity } : {}),
    },
  };
};

export const preparePageNavigation = (
  core: WorkbenchCore,
  target: NavigationTargetPage,
  current: PageState,
  mode: OwnedPlacementState,
  shell: OwnedPlacementState,
) => {
  const resolved = getPageLocationPreparation<WorkbenchWidgetPlacement>(core.pageLocations).resolve(target);
  const page = current.pages[resolved.pageId]!;
  const restored = restorePageOwners(core, current, resolved, mode, shell);
  const state = getWorkbenchPageRegistryInternals(core.pages).prepare.location(
    {
      pageId: page.id,
      projectId: requireProject(current),
      location: resolved.location,
      resource: resolved.location.resource,
      section: resolved.location.section,
      position: resolved.location.position,
      open: resolved.open,
      action: "preparePageNavigation",
    },
    current,
    restored.placements,
  );
  return { state, mode: restored.mode, shell: restored.shell, resolved };
};
