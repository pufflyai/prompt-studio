import type { PlacementIdentity, ResourceRef, ViewLocation } from "@pstdio/sdk/extensions";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import { isPageContent } from "../../registries/pages/page-main";
import { editPagePlacementStates } from "../../registries/pages/page-placement-state";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import {
  type OwnedPlacementState,
  updateResourcePlacementInstance,
  type WorkbenchOwnedPlacementItem,
} from "../../registries/placements/owned-placement-lifecycle";
import type { WorkbenchCore } from "../../workbench-core-types";

type ViewerReference = { resource: ResourceRef } & ViewLocation;
const retainOwnedViewer = (
  core: WorkbenchCore,
  state: OwnedPlacementState,
  identity: Exclude<PlacementIdentity, { kind: "page" }>,
  item: WorkbenchOwnedPlacementItem,
  reference: ViewerReference,
) => {
  const retained = { ...state, resourceInstances: new Map(state.resourceInstances) };
  updateResourcePlacementInstance({
    label: "Viewer",
    id: identity.placementId,
    item,
    state: retained,
    instanceKey: identity.instanceKey,
    resource: reference.resource,
    location: reference,
    open: "pin",
    keyOfResource: core.pages.resourceReferenceKey,
  });
  return retained;
};
export const prepareReusedViewerPin = (
  core: WorkbenchCore,
  identity: PlacementIdentity,
  reference: ViewerReference,
  state: {
    page: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>;
    mode: OwnedPlacementState;
    shell: OwnedPlacementState;
  },
) => {
  if (identity.kind === "mode") {
    const item = core.modePlacements.listPlacements().find((placement) => placement.id === identity.placementId)!.item;
    return { ...state, mode: retainOwnedViewer(core, state.mode, identity, item, reference) };
  }
  if (identity.kind === "shell") {
    const item = core.shellPlacements.getPlacement(identity.placementId)!.item;
    return { ...state, shell: retainOwnedViewer(core, state.shell, identity, item, reference) };
  }
  const references = editPagePlacementStates(state.page.pageStates, identity, { kind: "reference", ...reference });
  const pageStates = editPagePlacementStates(references, identity, { kind: "retention", open: "pin" });
  return { ...state, page: { ...state.page, pageStates } };
};
export const retainOutgoingViewerPins = (
  core: WorkbenchCore,
  pins: Iterable<PlacementIdentity>,
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
) => {
  const open = new Set(state.placements.map((placement) => placementIdentityKey(placement.identity)));
  for (const identity of pins) {
    if (open.has(placementIdentityKey(identity))) core.pinPlacement(identity);
  }
};
export const isReusedViewerPin = (
  open: string | undefined,
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  identity: PlacementIdentity,
) => open === "pin" && !isPageContent(state.pages[state.activePageId ?? ""], identity);
