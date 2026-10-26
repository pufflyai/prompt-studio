import type { PageSlotRef } from "@pstdio/sdk/extensions";
import type { WorkbenchModePlacementRegistry } from "./mode-placement-registry";

export const pageSlotReferenceKey = (ref: PageSlotRef) => JSON.stringify([ref.page.extensionId, ref.page.id, ref.id]);
export const replacedPageSlot = (registry: WorkbenchModePlacementRegistry, ref: PageSlotRef) =>
  registry
    .listPlacements()
    .find((placement) =>
      placement.replaces?.some((previous) => pageSlotReferenceKey(previous) === pageSlotReferenceKey(ref)),
    );
