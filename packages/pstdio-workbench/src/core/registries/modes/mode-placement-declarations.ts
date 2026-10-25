import type { PlacementRef } from "@pstdio/sdk/extensions";
import {
  placementItemForRegion,
  placementItemViewId,
  validateOwnedPlacementItem,
} from "../placements/owned-placement-lifecycle";
import type { WorkbenchViewRegistry } from "../views/view-registry";
import type { WorkbenchModePlacementContribution } from "./mode-placement-registry";
import { pageSlotReferenceKey } from "./placement-replacement";

export const placementRefKey = (ref: PlacementRef) => JSON.stringify([ref.extensionId, ref.id]);

export const validatePlacement = (input: {
  placement: WorkbenchModePlacementContribution;
  placements: Map<string, WorkbenchModePlacementContribution>;
  refs: Map<string, WorkbenchModePlacementContribution>;
  views: WorkbenchViewRegistry;
}) => {
  const { placement, placements, refs, views } = input;
  if (placements.has(placement.id)) throw new Error(`Mode placement already registered: ${placement.id}`);
  if (placement.ref.kind !== "placement" || !placement.ref.extensionId || !placement.ref.id) {
    throw new Error(`Mode placement "${placement.id}" must declare a normalized placement ref`);
  }
  const refKey = placementRefKey(placement.ref);
  const previous = new Set(
    [...placements.values()].flatMap((placement) => (placement.replaces ?? []).map(pageSlotReferenceKey)),
  );
  for (const ref of placement.replaces ?? []) {
    if (!ref.page.extensionId || ref.page.extensionId !== placement.ref.extensionId)
      throw new Error("A placement can replace only its own extension's page slots");
    const key = pageSlotReferenceKey(ref);
    if (previous.has(key)) throw new Error(`Page slot already replaced: ${key}`);
    previous.add(key);
  }
  if (refs.has(refKey)) throw new Error(`Mode placement ref already registered: ${refKey}`);
  if (placement.movableTo && !placement.movableTo.includes(placement.region)) {
    throw new Error(`Mode placement "${placement.id}" must include its initial region in movableTo`);
  }
  validateOwnedPlacementItem("Mode placement", placement.id, placement.item);
  if (!views.getView(placementItemViewId(placement.item))) {
    throw new Error(`Workbench mode placement view is not registered: ${placementItemViewId(placement.item)}`);
  }
  return refKey;
};

export const copyPlacement = (placement: WorkbenchModePlacementContribution) => ({
  ...placement,
  ref: { ...placement.ref },
  ...(placement.replaces ? { replaces: placement.replaces.map((ref) => ({ ...ref, page: { ...ref.page } })) } : {}),
  item: placementItemForRegion(placement.item, placement.region),
  ...(placement.addableIn ? { addableIn: [...placement.addableIn] } : {}),
  ...(placement.movableTo ? { movableTo: [...placement.movableTo] } : {}),
});
