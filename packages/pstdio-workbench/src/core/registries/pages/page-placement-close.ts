import type { PlacementIdentity, ResourceRef } from "@pstdio/sdk/extensions";
import { placementIdentityKey } from "../layout/placement-reconciliation";
import type { WorkbenchPageCloseResolution } from "./page-registry-internals";
import type { WorkbenchPageContribution, WorkbenchPageRegistryStoreState } from "./page-registry-types";
import { closePageSlot, emptyPageState, requirePageSlot } from "./page-slot-lifecycle";

export const resolvePagePlacementClose = <Value>(input: {
  identity: PlacementIdentity;
  page: WorkbenchPageContribution;
  state: WorkbenchPageRegistryStoreState<Value>;
  resourceKey(resource: ResourceRef): string;
  stateKey: string;
}): WorkbenchPageCloseResolution => {
  const { identity, page, state } = input;
  if (identity.kind !== "page") throw new Error("Page registry can close only page-owned placements");
  if (state.activePageId !== identity.pageId) throw new Error(`Page is not active: ${identity.pageId}`);
  const slot = requirePageSlot(page, identity.slotId);
  const exists = state.placements.some(
    (candidate) => placementIdentityKey(candidate.identity) === placementIdentityKey(identity),
  );
  if (!exists) throw new Error(`Page placement is not open: ${placementIdentityKey(identity)}`);
  if (slot.role === "primary" && identity.instanceKey === "default") {
    throw new Error(`Static primary placement is not closable: ${page.id}.${slot.id}`);
  }

  const pageState = state.pageStates[input.stateKey] ?? emptyPageState(page);
  const closedActivePrimary = slot.role === "primary" && pageState.activePrimaryInstanceKey === identity.instanceKey;
  const result = closePageSlot({ page, slot, state: pageState, instanceKey: identity.instanceKey });
  const pageStates = { ...state.pageStates, [input.stateKey]: result.state };
  if (result.kind === "parent") return { kind: "parent", pageStates, parentId: result.parentId };
  if (slot.role === "auxiliary") {
    if (!state.location) throw new Error("Active page has no canonical location");
    return {
      kind: "stay",
      pageStates,
      target: {
        pageId: page.id,
        ...(state.location.resource ? { resource: state.location.resource } : {}),
        ...(state.location.section ? { section: state.location.section } : {}),
      },
      locationChanged: false,
    };
  }
  const activeInstanceKey = result.state.activePrimaryInstanceKey;
  const activeInstance = (result.state.resourceInstances[slot.id] ?? []).find(
    (instance) => instance.instanceKey === activeInstanceKey,
  );
  return {
    kind: "stay",
    pageStates,
    target: {
      pageId: page.id,
      ...(activeInstance?.resource ? { resource: activeInstance.resource } : {}),
      ...(activeInstance?.section ? { section: activeInstance.section } : {}),
      ...(activeInstance?.open ? { open: activeInstance.open } : {}),
    },
    locationChanged: closedActivePrimary,
  };
};
