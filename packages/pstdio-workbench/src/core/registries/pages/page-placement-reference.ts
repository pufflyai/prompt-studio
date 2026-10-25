import { contributionRefId, type PlacementIdentity, type ResourceRef, type ViewLocation } from "@pstdio/sdk/extensions";
import { resourceMatchesConstraint } from "../../shared/contributions/reference-id";
import { placementIdentityKey, reconcileOwnedPlacements } from "../layout/placement-reconciliation";
import { isPageContent, pageSlots } from "./page-main";
import { editPagePlacementStates } from "./page-placement-state";
import type { CreateWorkbenchPageRegistryInput, WorkbenchPageRegistryStoreState } from "./page-registry-types";

export const refreshPagePlacementReference = <Value>(
  state: WorkbenchPageRegistryStoreState<Value>,
  identity: PlacementIdentity,
  reference: { resource: ResourceRef } & ViewLocation,
  input: CreateWorkbenchPageRegistryInput<Value>,
) => {
  if (identity.kind !== "page") throw new Error("Page registry updates only page-owned placements");
  const page = state.pages[identity.pageId];
  const slot = page && pageSlots(page).find((slot) => slot.id === identity.slotId);
  if (slot?.item.kind !== "binding" || !resourceMatchesConstraint(slot.item.binding, reference.resource))
    throw new Error("Page viewer does not accept this resource kind");
  const key = placementIdentityKey(identity);
  const binding = slot.item.binding;
  const instance = Object.entries(state.pageStates)
    .filter(([key]) => key === identity.pageId || key.startsWith(`${identity.pageId}|`))
    .flatMap(([, page]) => page.resourceInstances[identity.slotId] ?? [])
    .find((entry) => entry.instanceKey === identity.instanceKey);
  const placements = state.placements.map((entry) =>
    placementIdentityKey(entry.identity) === key
      ? {
          ...entry,
          value: input.resolvePagePlacement({
            identity,
            pageId: page.id,
            slotId: slot.id,
            role: slot.role,
            viewId: contributionRefId(binding.view),
            ...reference,
            pageContext: reference.pageContext ?? instance?.pageContext,
            open: instance?.open,
            closable: !isPageContent(page, identity),
          }),
        }
      : entry,
  );
  return {
    ...state,
    pageStates: editPagePlacementStates(state.pageStates, identity, { kind: "reference", ...reference }),
    placements,
    reconciliation: reconcileOwnedPlacements({
      current: state.placements,
      desired: placements,
      valuesEqual: input.valuesEqual,
    }),
  };
};
