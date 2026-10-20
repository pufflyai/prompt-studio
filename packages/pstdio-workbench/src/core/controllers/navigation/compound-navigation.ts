import type { PageSlotRef, PlacementIdentity } from "@pstdio/sdk/extensions";
import { contributionRefId } from "@pstdio/sdk/extensions";
import type { WorkbenchRegion, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { type PlacementDestination, placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import { isWorkbenchModePanelAvailable } from "../../registries/modes/mode-layout";
import type { NavigationTargetPage, NavigationTargetPanel } from "../../registries/navigation/navigation-registry";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import type { WorkbenchEditorOpen } from "../../registries/pages/page-registry-types";
import type { OwnedPlacementState } from "../../registries/placements/owned-placement-lifecycle";
import { getOwnedPlacementPreparation } from "../../registries/placements/owned-placement-preparation";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import type { WorkbenchCore } from "../../workbench-core-types";
import { getPageLocationPreparation } from "../page-location/page-location-preparation";
import { requirePanelOpen } from "../shell/panel-open-policy";

import { resourceEditorPageForPanel } from "./resource-editor-lookup";

type NavigationOperation = NavigationTargetPage | NavigationTargetPanel;

export const panelModeId = (core: WorkbenchCore, target: NavigationTargetPanel, proposedModeId?: string) => {
  const modeId = proposedModeId ?? core.modes.getActiveModeId();
  const mode = modeId ? core.modes.getMode(modeId) : undefined;
  if (target.region && !isWorkbenchModePanelAvailable(mode, target.region))
    throw new Error(`Panel cannot open in ${target.region}`);
  return modeId;
};

const recordPanelOpenings = (
  target: NavigationOperation,
  placements: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>["reconciliation"]["activate"],
  activate: Map<WorkbenchRegion, PlacementIdentity>,
  destinations: Map<string, PlacementDestination>,
) => {
  const region = target.kind === "panel" ? target.region : undefined;
  for (const placement of placements) {
    activate.set(region ?? placement.region, placement.identity);
    if (region) destinations.set(placementIdentityKey(placement.identity), { identity: placement.identity, region });
  }
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
      { placementId: placement.id, resource: target.resource, open: target.open, region: target.region },
      modeState,
    );
    return { modeState: prepared.state, shellState, identity: prepared.identity };
  }
  const prepared = getOwnedPlacementPreparation(core.shellPlacements).open(
    {
      placementId: panel.id,
      resource: target.resource,
      open: target.open,
      region: target.region,
      ...("title" in target ? { title: target.title } : {}),
    },
    shellState,
  );
  return { modeState, shellState: prepared.state, identity: prepared.identity };
};

const preparePageNavigation = (
  core: WorkbenchCore,
  target: NavigationTargetPage,
  current: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  modeState: OwnedPlacementState,
  shellState: OwnedPlacementState,
  activate?: readonly PlacementIdentity[],
  editorOpens: readonly WorkbenchEditorOpen[] = [],
) => {
  const pages = getWorkbenchPageRegistryInternals(core.pages);
  const locations = getPageLocationPreparation<WorkbenchWidgetPlacement>(core.pageLocations);
  const mode = getOwnedPlacementPreparation(core.modePlacements);
  const shell = getOwnedPlacementPreparation(core.shellPlacements);
  if (!current.projectId) throw new Error("Cannot navigate before a project is active");
  const resolved = locations.resolve(target, current);
  const page = current.pages[resolved.pageId]!;
  const modeId = resolved.location.mode ? contributionRefId(resolved.location.mode) : page.modeId;
  shellState =
    shell.restore?.(
      { modeId, pageId: page.id, projectId: current.projectId, location: resolved.location },
      shellState,
      placementContext(current),
    ) ?? shellState;
  modeState =
    mode.restore?.({ modeId, pageId: page.id, location: resolved.location, projectId: current.projectId }, modeState) ??
    modeState;
  const editorActivation =
    resolved.activate === undefined && activate === undefined
      ? undefined
      : [...(resolved.activate ?? []), ...(activate ?? [])];
  const proposed = pages.prepare.location(
    {
      pageId: page.id,
      projectId: current.projectId,
      location: resolved.location,
      resource: resolved.location.resource,
      section: resolved.location.section,
      open: resolved.open,
      activate: editorActivation,
      editorOpens: [...(resolved.editorOpens ?? []), ...editorOpens],
      action: "preparePageNavigation",
    },
    current,
    { shell: shell.resolve(undefined, shellState), mode: mode.resolve(modeId, modeState) },
  );

  return { proposed, modeState, shellState, editorOpens: [...(resolved.editorOpens ?? []), ...editorOpens] };
};

const resolveEditorNavigationTarget = (
  core: WorkbenchCore,
  requested: NavigationOperation,
  proposed: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
) => {
  if (requested.kind === "page") return { target: requested, activate: undefined, editorOpens: undefined };
  panelModeId(core, requested, proposed.activeModeId);
  if (requested.region)
    requirePanelOpen(core, requested.region, {
      modeId: proposed.activeModeId,
      requestedRegion: requested.region,
      proposed,
    });
  return (
    resourceEditorPageForPanel(core, requested, proposed) ?? {
      target: requested,
      activate: undefined,
      editorOpens: undefined,
    }
  );
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
  const destinations = new Map<string, PlacementDestination>();
  const editorOpens = new Map<string, WorkbenchEditorOpen>();
  const owned = (modeId = proposed.activeModeId) => ({
    shell: shell.resolve(undefined, shellState),
    mode: mode.resolve(modeId, modeState),
  });

  for (const requested of targets) {
    const {
      target,
      activate: editorActivation,
      editorOpens: editorRequests,
    } = resolveEditorNavigationTarget(core, requested, proposed);
    const beforeOpen = proposed;
    if (target.kind === "page") {
      const next = preparePageNavigation(
        core,
        target,
        proposed,
        modeState,
        shellState,
        editorActivation,
        editorRequests,
      );
      for (const request of next.editorOpens) editorOpens.set(placementIdentityKey(request.identity), request);
      proposed = next.proposed;
      modeState = next.modeState;
      shellState = next.shellState;
    } else if (target.kind === "panel") {
      const modeId = panelModeId(core, target, proposed.activeModeId);
      const panel = target.panel;
      if (panel.kind === "page-slot") {
        const page = requirePanelPage(proposed, panel);
        proposed = pages.prepare.slot(
          { pageId: page.id, slotId: panel.id, resource: target.resource, open: target.open, region: target.region },
          proposed,
          owned(),
        );
      } else {
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
    if (target.kind === "panel") {
      for (const placement of proposed.reconciliation.activate)
        requirePanelOpen(core, target.region ?? placement.region, {
          modeId: proposed.activeModeId,
          identity: placement.identity,
          resource: target.resource,
          requestedRegion: target.region,
          proposed: beforeOpen,
        });
    }
    recordPanelOpenings(target, proposed.reconciliation.activate, activate, destinations);
  }
  const present = new Set(proposed.placements.map((placement) => placementIdentityKey(placement.identity)));
  const final = pages.prepare.compose(
    original,
    {
      ...proposed,
      activate: [...activate.values()].filter((identity) => present.has(placementIdentityKey(identity))),
      destinations: [...destinations.values()],
      editorOpens: [...editorOpens.values()],
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
