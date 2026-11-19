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
import type { WorkbenchCore } from "../../workbench-core-types";
import { getPageLocationPreparation } from "../page-location/page-location-preparation";
import type { ResolvedPageLocation } from "../page-location/page-location-types";
import { reusableNavigationViewer } from "../resource-viewers/reusable-navigation-viewer";
import { requirePanelOpen } from "../shell/panel-open-policy";
import { prepareMainDeparture } from "./main-page-departure";
import { preparePageNavigation } from "./page-navigation-preparation";
import { requireCorePanelTargets } from "./panel-target";
import { commitPreparedNavigation } from "./prepared-navigation-commit";
import {
  finalHostTransfers,
  panelTransferLocation,
  prepareResourceTransfer,
  retainTransferredPin,
} from "./resource-transfer";
import { isReusedViewerPin, prepareReusedViewerPin, recordOutgoingViewerPins } from "./reused-viewer-pin";

type NavigationOperation = NavigationTargetPage | NavigationTargetPanel;
type PageState = WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>;
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
  for (const placement of placements) {
    let region = target.kind === "panel" ? target.region : undefined;
    if (target.kind === "page" && placement.region === "main") region = "main";
    activate.set(region ?? placement.region, placement.identity);
    if (region) destinations.set(placementIdentityKey(placement.identity), { identity: placement.identity, region });
  }
};

const recordExplicitDestination = (
  target: NavigationOperation,
  identity: PlacementIdentity,
  destinations: Map<string, PlacementDestination>,
) => {
  if (target.kind === "panel" && target.region)
    destinations.set(placementIdentityKey(identity), { identity, region: target.region });
};

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
  location?: ViewLocation,
) => {
  const panel = target.panel;
  if (panel.kind === "placement") {
    const placement = core.modePlacements.getPlacement(panel);
    if (!placement || placement.modeId !== modeId)
      throw new Error(`Mode panel "${panel.id}" is not owned by the proposed mode`);
    const prepared = getOwnedPlacementPreparation(core.modePlacements).open(
      { placementId: placement.id, resource: target.resource, open: target.open, region: target.region, location },
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
      location,
      ...("title" in target ? { title: target.title } : {}),
    },
    shellState,
  );
  return { modeState, shellState: prepared.state, identity: prepared.identity };
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

export const prepareWorkbenchNavigation = (
  core: WorkbenchCore,
  targets: readonly NavigationOperation[],
  options: {
    reuseViewers?: boolean;
    location?: ViewLocation;
    replace?: WorkbenchWidgetPlacement;
    history?: "push" | "replace" | "none";
  } = {},
) => {
  requireCorePanelTargets(core, targets);
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
  const outgoingPins = new Map<string, PlacementIdentity>();
  const consumedMemory: PageLocation[] = [];
  const activate = new Map<WorkbenchRegion, PlacementIdentity>();
  const destinations = new Map<string, PlacementDestination>();
  const transfers: { source: WorkbenchWidgetPlacement; destination: WorkbenchWidgetPlacement }[] = [];
  const owned = (modeId = proposed.activeModeId) => ({
    shell: shell.resolve(undefined, shellState),
    mode: mode.resolve(modeId, modeState),
  });

  for (const rawTarget of targets) {
    const target = retainTransferredPin(core, rawTarget, original);
    const departure = prepareMainDeparture(core, target, proposed, modeState, shellState, destinations);
    proposed = departure.page;
    modeState = departure.mode;
    shellState = departure.shell;
    const beforeOpen = proposed;
    resourceToFocus = undefined;
    const reusable = reusableNavigationViewer(core, target, proposed, options.reuseViewers);
    if (reusable) {
      activate.set(reusable.region, reusable.identity);
      recordExplicitDestination(target, reusable.identity, destinations);
      resourceToFocus = referenceForTarget(target, locations.resolve);
      references.set(placementIdentityKey(reusable.identity), resourceToFocus);
      if (isReusedViewerPin(target.open, proposed, reusable.identity)) {
        const identity = reusable.identity;
        outgoingPins.set(placementIdentityKey(identity), identity);
        const retained = prepareReusedViewerPin(core, identity, resourceToFocus, {
          page: proposed,
          mode: modeState,
          shell: shellState,
        });
        proposed = retained.page;
        modeState = retained.mode;
        shellState = retained.shell;
      }
      continue;
    }
    if (target.kind === "page") {
      const page = preparePageNavigation(core, target, proposed, modeState, shellState);
      proposed = page.state;
      modeState = page.mode;
      shellState = page.shell;
      if (page.resolved.consumeRemembered) consumedMemory.push(page.resolved.consumeRemembered);
    } else if (target.kind === "panel") {
      const modeId = panelModeId(core, target, proposed.activeModeId);
      const panel = target.panel;
      const location = panelTransferLocation(core, target, beforeOpen, original, options.location, departure.source);
      if (panel.kind === "page-slot") {
        const page = requirePanelPage(proposed, panel);
        proposed = pages.prepare.slot(
          {
            pageId: page.id,
            slotId: panel.id,
            resource: target.resource,
            open: target.open,
            region: target.region,
            ...location,
          },
          proposed,
          owned(),
        );
      } else {
        const prepared = prepareSharedPanel(core, target, modeId, modeState, shellState, location);
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
    const transfer = prepareResourceTransfer(core, target, {
      before: beforeOpen,
      original,
      page: proposed,
      mode: modeState,
      shell: shellState,
      replacement: options.replace ?? departure?.source,
    });
    proposed = transfer.page;
    modeState = transfer.mode;
    shellState = transfer.shell;
    transfers.push(...transfer.hosts);

    recordOutgoingViewerPins(target.open, beforeOpen, proposed.reconciliation.activate, outgoingPins);
    validatePanelOpenings(core, target, beforeOpen, proposed);
    recordPanelOpenings(target, proposed.reconciliation.activate, activate, destinations);
  }
  const desired = pages.prepare.compose(
    original,
    { ...proposed, activate: [], action: "prepareCompoundOwners" },
    owned(),
  );
  const present = new Set(desired.placements.map((placement) => placementIdentityKey(placement.identity)));
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
      commitPreparedNavigation({
        core,
        original,
        pins: outgoingPins.values(),
        transfers: finalHostTransfers(transfers, final),
        owners: [
          { owner: mode, previous: originalMode, next: modeState },
          { owner: shell, previous: originalShell, next: shellState },
        ],
        publish: (beforePublish) => {
          if (final.location) return locations.commit(final, beforePublish, consumedMemory, options.history);
          return locations.commitUnavailable(
            final,
            beforePublish,
            options.history ?? (original.location ? "push" : "none"),
          );
        },
        afterPublish: () => applyViewerReferences(core, references.values(), resourceToFocus, targets.at(-1)),
      }),
  };
};
