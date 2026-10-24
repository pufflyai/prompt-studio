import type { PageLocation, PageSlotRef, PlacementIdentity, ResourceRef, ViewLocation } from "@pstdio/sdk/extensions";
import type { WorkbenchRegion, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { type PlacementDestination, placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import { isWorkbenchModePanelAvailable } from "../../registries/modes/mode-layout";
import { replacedPageSlot } from "../../registries/modes/placement-replacement";
import type { NavigationTargetPage, NavigationTargetPanel } from "../../registries/navigation/navigation-registry";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import type { OwnedPlacementState } from "../../registries/placements/owned-placement-lifecycle";
import { getOwnedPlacementPreparation } from "../../registries/placements/owned-placement-preparation";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import type { WorkbenchCore } from "../../workbench-core-types";
import { getPageLocationPreparation } from "../page-location/page-location-preparation";
import type { ResolvedPageLocation } from "../page-location/page-location-types";
import { preparePageLanding } from "../page-runtime/page-panel-view";
import { reusableNavigationViewer } from "../resource-viewers/reusable-navigation-viewer";
import { requirePanelOpen } from "../shell/panel-open-policy";

type NavigationOperation = NavigationTargetPage | NavigationTargetPanel;
type PageState = WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>;
const requireProject = (state: PageState) => {
  if (!state.projectId) throw new Error("Cannot navigate before a project is active");
  return state.projectId;
};

const validatePanelOpenings = (
  core: WorkbenchCore,
  target: NavigationOperation,
  before: PageState,
  proposed: PageState,
) => {
  if (target.kind !== "panel") return;
  for (const placement of proposed.reconciliation.activate)
    requirePanelOpen(core, target.region ?? placement.region, {
      modeId: proposed.activeModeId,
      identity: placement.identity,
      resource: target.resource,
      requestedRegion: target.region,
      proposed: before,
    });
};

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
  const restored = mode.restore?.(context, modeState) ?? modeState;
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

type ResourceReference = { resource: ResourceRef } & ViewLocation;
const referenceForTarget = (
  target: NavigationOperation,
  resolve: (target: NavigationTargetPage) => ResolvedPageLocation,
): ResourceReference => {
  if (target.kind !== "page") return { resource: target.resource! };
  const { location } = resolve(target);
  return {
    resource: target.resource!,
    section: location.section,
    position: location.position,
    pageContext: { page: location.page, parent: location.parent, params: location.params },
  };
};
const applyViewerReferences = (
  core: WorkbenchCore,
  references: Iterable<ResourceReference>,
  focused: ResourceReference | undefined,
  last: NavigationOperation | undefined,
) => {
  for (const reference of references) core.viewers.refreshReference(reference.resource, reference);
  if (focused) core.viewers.focusResource(focused.resource, focused);
  else if (last?.kind === "page" && core.pages.getContent()) core.focus.setActiveRegion("main");
};

export const prepareWorkbenchNavigation = (core: WorkbenchCore, targets: readonly NavigationOperation[]) => {
  targets = targets.map((target) => {
    const replacement =
      target.kind === "panel" && target.panel.kind === "page-slot"
        ? replacedPageSlot(core.modePlacements, target.panel)
        : undefined;
    return replacement ? { ...target, kind: "panel" as const, panel: replacement.ref } : target;
  });
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
  let resourceToFocus: ({ resource: ResourceRef } & ViewLocation) | undefined;
  const references = new Map<string, { resource: ResourceRef } & ViewLocation>();
  const consumedMemory: PageLocation[] = [];
  const activate = new Map<WorkbenchRegion, PlacementIdentity>();
  const destinations = new Map<string, PlacementDestination>();
  const owned = (modeId = proposed.activeModeId) => ({
    shell: shell.resolve(undefined, shellState),
    mode: mode.resolve(modeId, modeState),
  });

  for (const target of targets) {
    const beforeOpen = proposed;
    resourceToFocus = undefined;
    const reusable = reusableNavigationViewer(core, target, proposed);
    if (reusable) {
      activate.set(reusable.region, reusable.identity);
      resourceToFocus = referenceForTarget(target, locations.resolve);
      references.set(placementIdentityKey(reusable.identity), resourceToFocus);
      continue;
    }
    if (target.kind === "page") {
      const projectId = requireProject(proposed);
      const resolved = locations.resolve(target);
      if (resolved.consumeRemembered) consumedMemory.push(resolved.consumeRemembered);
      const page = proposed.pages[resolved.pageId]!;
      const restored = restorePageOwners(core, proposed, resolved, modeState, shellState);
      shellState = restored.shell;
      modeState = restored.mode;
      proposed = pages.prepare.location(
        {
          pageId: page.id,
          projectId,
          location: resolved.location,
          resource: resolved.location.resource,
          section: resolved.location.section,
          position: resolved.location.position,
          open: resolved.open,
          action: "preparePageNavigation",
        },
        proposed,
        restored.placements,
      );
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
    validatePanelOpenings(core, target, beforeOpen, proposed);
    recordPanelOpenings(target, proposed.reconciliation.activate, activate, destinations);
  }
  const present = new Set(proposed.placements.map((placement) => placementIdentityKey(placement.identity)));
  const final = pages.prepare.compose(
    original,
    {
      ...proposed,
      activate: [...activate.values()].filter((identity) => present.has(placementIdentityKey(identity))),
      destinations: [...destinations.values()],
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
        const result = final.location ? locations.commit(final, applyOwners, consumedMemory) : publishWithoutLocation();
        if (modeState !== originalMode) mode.publish();
        if (shellState !== originalShell) shell.publish();
        applyViewerReferences(core, references.values(), resourceToFocus, targets.at(-1));
        return result;
      }),
  };
};
