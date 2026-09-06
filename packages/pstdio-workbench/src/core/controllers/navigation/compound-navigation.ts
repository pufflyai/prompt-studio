import type { PageSlotRef, PlacementIdentity } from "@pstdio/sdk/extensions";
import type { WorkbenchRegion, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import type { NavigationTargetPage, NavigationTargetPanel } from "../../registries/navigation/navigation-registry";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import type { OwnedPlacementState } from "../../registries/placements/owned-placement-lifecycle";
import { getOwnedPlacementPreparation } from "../../registries/placements/owned-placement-preparation";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import type { WorkbenchCore } from "../../workbench-core-types";
import { getPageLocationPreparation } from "../page-location/page-location-preparation";

type NavigationOperation = NavigationTargetPage | NavigationTargetPanel;

const placementContext = (state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>) =>
  state.activeModeId
    ? {
        modeId: state.activeModeId,
        pageId: state.activePageId,
        projectId: state.projectId,
        location: state.location,
      }
    : undefined;
const requirePanelPage = (state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>, panel: PageSlotRef) => {
  const page = Object.values(state.pages).find(
    (page) => page.ref.extensionId === panel.page.extensionId && page.ref.id === panel.page.id,
  );
  if (!page || page.id !== state.activePageId)
    throw new Error(`Page panel "${panel.id}" is not owned by the proposed page`);
  return page;
};
const prepareSharedPanel = (
  core: WorkbenchCore,
  target: NavigationTargetPanel,
  modeId: string | undefined,
  modeState: OwnedPlacementState,
  shellState: OwnedPlacementState,
) => {
  const panel = target.panel;
  if (panel.kind === "placement") {
    const placement = core.modePlacements.getPlacement(panel);
    if (!placement || placement.modeId !== modeId)
      throw new Error(`Mode panel "${panel.id}" is not owned by the proposed mode`);
    const prepared = getOwnedPlacementPreparation(core.modePlacements).open(
      { placementId: placement.id, resource: target.resource, open: target.open },
      modeState,
    );
    return { modeState: prepared.state, shellState, identity: prepared.identity };
  }
  const prepared = getOwnedPlacementPreparation(core.shellPlacements).open(
    {
      placementId: panel.id,
      resource: target.resource,
      open: target.open,
      ...("title" in target ? { title: target.title } : {}),
    },
    shellState,
  );
  return { modeState, shellState: prepared.state, identity: prepared.identity };
};

export const prepareWorkbenchNavigation = (core: WorkbenchCore, targets: readonly NavigationOperation[]) => {
  if (!targets.length) throw new Error("Compound navigation requires at least one page or panel target");
  const pages = getWorkbenchPageRegistryInternals(core.pages);
  const locations = getPageLocationPreparation<WorkbenchWidgetPlacement>(core.pageLocations);
  const mode = getOwnedPlacementPreparation(core.modePlacements);
  const shell = getOwnedPlacementPreparation(core.shellPlacements);
  const original = core.pages.store.getState();
  const originalMode = mode.getState();
  const originalShell = shell.getState();
  let modeState = originalMode;
  let shellState = originalShell;
  let proposed = original;
  const activate = new Map<WorkbenchRegion, PlacementIdentity>();
  const owned = (modeId = proposed.activeModeId) => ({
    shell: shell.resolve(undefined, shellState),
    mode: mode.resolve(modeId, modeState),
  });

  for (const target of targets) {
    if (target.kind === "page") {
      if (!proposed.projectId) throw new Error("Cannot navigate before a project is active");
      const resolved = locations.resolve(target);
      const page = proposed.pages[resolved.pageId]!;
      shellState =
        shell.restore?.(
          { modeId: page.modeId, pageId: page.id, projectId: proposed.projectId, location: resolved.location },
          shellState,
          placementContext(proposed),
        ) ?? shellState;
      modeState =
        mode.restore?.(
          { modeId: page.modeId, pageId: page.id, location: resolved.location, projectId: proposed.projectId },
          modeState,
        ) ?? modeState;
      proposed = pages.prepare.location(
        {
          pageId: page.id,
          projectId: proposed.projectId,
          location: resolved.location,
          resource: resolved.location.resource,
          section: resolved.location.section,
          open: resolved.open,
          action: "preparePageNavigation",
        },
        proposed,
        owned(page.modeId),
      );
    } else if (target.kind === "panel") {
      const panel = target.panel;
      if (panel.kind === "page-slot") {
        const page = requirePanelPage(proposed, panel);
        proposed = pages.prepare.slot(
          { pageId: page.id, slotId: panel.id, resource: target.resource, open: target.open },
          proposed,
          owned(),
        );
      } else {
        const modeId = proposed.activeModeId ?? core.modes.getActiveModeId();
        const prepared = prepareSharedPanel(core, target, modeId, modeState, shellState);
        modeState = prepared.modeState;
        shellState = prepared.shellState;
        const identity = prepared.identity;
        proposed = pages.prepare.compose(
          proposed,
          { ...proposed, activeModeId: modeId, activate: [identity], action: "preparePanelNavigation" },
          owned(modeId),
        );
      }
    } else {
      throw new Error("Compound navigation accepts only page and panel targets");
    }
    for (const placement of proposed.reconciliation.activate) activate.set(placement.region, placement.identity);
  }
  const present = new Set(proposed.placements.map((placement) => placementIdentityKey(placement.identity)));
  const final = pages.prepare.compose(
    original,
    {
      ...proposed,
      activate: [...activate.values()].filter((identity) => present.has(placementIdentityKey(identity))),
      action: "prepareCompoundNavigation",
    },
    owned(),
  );
  return {
    commit: () =>
      batchWorkbenchChanges(() => {
        const applyOwners = () => {
          mode.apply(modeState);
          shell.apply(shellState);
        };
        const publishWithoutLocation = () => {
          applyOwners();
          return pages.publish(final, "navigateCompoundTarget");
        };
        const result = final.location ? locations.commit(final, applyOwners) : publishWithoutLocation();
        if (modeState !== originalMode) mode.publish();
        if (shellState !== originalShell) shell.publish();
        return result;
      }),
  };
};
